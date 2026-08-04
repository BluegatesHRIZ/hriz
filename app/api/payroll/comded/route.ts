import { NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/auth/jwt-edge"
import { authorizeApiRequest } from "@/lib/auth/authorization"
import { prisma } from "@/lib/db/prisma"

/**
 * Pay components (`comded`) — the chart of earnings and deductions, and the
 * authority on what enters taxable income.
 *
 * `cd_tax` is the taxable checkbox. It applies to deductions as well as
 * credits, and means "does this line PARTICIPATE in taxable income":
 * absences and statutory contributions reduce the base, loan repayments and
 * coop deductions do not.
 *
 * `cd_slip = '0'` marks the CD10xx/CD11xx/CD12xx/CD13xx audit-snapshot rows,
 * which store bracket values rather than money. They are never editable and
 * are excluded from the list by default.
 */

/** Snapshot rows are bookkeeping, not user-facing components. */
const SNAPSHOT_SLIP = "0"

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    try {
      await verifyToken(authHeader.substring(7))
    } catch {
      return NextResponse.json({ message: "Invalid token" }, { status: 401 })
    }

    // `?all=1` includes the audit-snapshot rows; the default hides them.
    const includeAll = request.nextUrl.searchParams.get("all") === "1"

    const comdedList = await prisma.comded.findMany({
      select: {
        cd_code: true,
        cd_desc: true,
        cd_type: true,
        cd_ord: true,
        cd_tax: true,
        cd_slip: true,
      },
      orderBy: [
        { cd_type: "asc" },
        { cd_ord: "asc" },
      ],
    })

    const rows = includeAll
      ? comdedList
      : comdedList.filter((c) => c.cd_slip !== SNAPSHOT_SLIP)

    return NextResponse.json(rows)
  } catch (error) {
    console.error("Get comded list error:", error)
    return NextResponse.json(
      { message: "Internal server error", error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/payroll/comded
 * Body: { updates: [{ code: "CD4", taxable: false }, ...] }
 *
 * Flips the taxable checkbox on one or more components. This changes what
 * future payroll runs withhold, so it is gated behind the payroll write
 * permission and refuses to touch the snapshot rows.
 *
 * Already-posted runs are NOT affected — each payslip stored the amounts it
 * computed. Recomputing a draft run will pick up the new setting.
 */
export async function PATCH(request: NextRequest) {
  const auth = await authorizeApiRequest(request, "apiPayrollRunWrite")
  if (!auth.ok) return auth.response

  try {
    const body = await request.json()
    const updates: Array<{ code?: string; taxable?: boolean }> = body?.updates ?? []

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json(
        { message: "`updates` must be a non-empty array of { code, taxable }" },
        { status: 400 },
      )
    }

    const codes = updates.map((u) => u.code).filter(Boolean) as string[]
    const existing = await prisma.comded.findMany({
      where: { cd_code: { in: codes } },
      select: { cd_code: true, cd_slip: true },
    })
    const known = new Map(existing.map((e) => [e.cd_code, e]))

    const missing = codes.filter((c) => !known.has(c))
    if (missing.length) {
      return NextResponse.json(
        { message: `Unknown component code(s): ${missing.join(", ")}` },
        { status: 400 },
      )
    }

    const snapshots = codes.filter((c) => known.get(c)?.cd_slip === SNAPSHOT_SLIP)
    if (snapshots.length) {
      return NextResponse.json(
        {
          message:
            `Cannot edit audit-snapshot components (${snapshots.join(", ")}) — ` +
            "they store bracket values, not pay.",
        },
        { status: 400 },
      )
    }

    await prisma.$transaction(
      updates.map((u) =>
        prisma.comded.update({
          where: { cd_code: u.code! },
          data: { cd_tax: u.taxable ? 1 : 0 },
        }),
      ),
    )

    return NextResponse.json({ updated: updates.length })
  } catch (error) {
    console.error("Update comded error:", error)
    return NextResponse.json(
      { message: "Failed to update pay components" },
      { status: 500 },
    )
  }
}
