import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { verifyToken } from "@/lib/auth/jwt-edge"
import { parsePagination, paginate } from "@/lib/pagination"

/**
 * GET /api/employee/list/all
 * List all active employees, paginated. Ported from
 * EmployeeController.GetEmployeeList.
 *
 * Optional query params (all additive — omitting them preserves the original
 * behaviour):
 *   page, limit          server-side pagination
 *   search               free text over id / last / first / middle name
 *   dept, loc, pos       exact-match code filters
 *   idsOnly=1            every matching id, unpaginated. Powers
 *                        "select all N matching" without walking each page.
 *
 * Each row also carries `has_salary` — whether the employee has an active
 * `empsalary` record. Payroll uses it to flag who a run would skip.
 */

function buildWhere(searchParams: URLSearchParams) {
  const search = (searchParams.get("search") ?? "").trim()
  const dept = (searchParams.get("dept") ?? "").trim()
  const loc = (searchParams.get("loc") ?? "").trim()
  const pos = (searchParams.get("pos") ?? "").trim()

  const where: Record<string, unknown> = { emp_status: 1 } // active only
  if (dept) where.emp_dept = dept
  if (loc) where.emp_loc = loc
  if (pos) where.emp_pos = pos
  if (search) {
    where.OR = [
      { emp_id: { contains: search } },
      { emp_last: { contains: search } },
      { emp_first: { contains: search } },
      { emp_mid: { contains: search } },
    ]
  }
  return where
}
export async function GET(request: NextRequest) {
  try {
    // Check authorization
    const authHeader = request.headers.get("authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      )
    }

    try {
      await verifyToken(authHeader.substring(7))
    } catch {
      return NextResponse.json(
        { message: "Invalid token" },
        { status: 401 }
      )
    }

    // Note: The C# version uses a stored procedure "employee_display_list"
    // For now, we'll fetch directly from the Employee table
    // TODO: Implement stored procedure call or create equivalent query
    
    const searchParams = request.nextUrl.searchParams
    const where = buildWhere(searchParams)

    // "Select all N matching" — ids only, unpaginated, no joins.
    if (searchParams.get("idsOnly") === "1") {
      const rows = await prisma.employee.findMany({
        where,
        select: { emp_id: true },
        orderBy: { emp_last: "asc" },
      })
      return NextResponse.json({ ids: rows.map((r) => r.emp_id) })
    }

    const { page, limit, skip, take } = parsePagination(searchParams)
    const [total, employees] = await Promise.all([
      prisma.employee.count({ where }),
      prisma.employee.findMany({
        where,
        select: {
          emp_id: true,
          emp_first: true,
          emp_last: true,
          emp_mid: true,
          emp_dept: true,
          emp_pos: true,
          emp_loc: true,
          emp_role: true,
          emp_status: true,
          emp_extid: true,
          emp_datecreated: true,
        },
        orderBy: {
          emp_last: "asc",
        },
        skip,
        take,
      }),
    ])

    // Enrich codes with human-readable descriptions from the lookup tables.
    // The salary lookup is scoped to this page's ids; the reference tables are
    // small enough to fetch whole and map in memory.
    const ids = employees.map((e) => e.emp_id)
    const [departments, positions, locations, salaried] = await Promise.all([
      prisma.department.findMany({ select: { dep_id: true, dep_desc: true } }),
      prisma.position.findMany({ select: { pst_id: true, pst_desc: true } }),
      prisma.location.findMany({ select: { loc_id: true, loc_desc: true } }),
      ids.length
        ? prisma.empsalary.findMany({
            where: { emp_salstatus: 1, emp_id: { in: ids } },
            select: { emp_id: true },
            distinct: ["emp_id"],
          })
        : Promise.resolve([] as Array<{ emp_id: string }>),
    ])
    const hasSalary = new Set(salaried.map((s) => s.emp_id))
    const depMap = new Map(departments.map((d) => [d.dep_id, d.dep_desc]))
    const posMap = new Map(positions.map((p) => [p.pst_id, p.pst_desc]))
    const locMap = new Map(locations.map((l) => [l.loc_id, l.loc_desc]))

    const enriched = employees.map((e) => ({
      ...e,
      emp_dept_desc: e.emp_dept ? depMap.get(e.emp_dept) ?? null : null,
      emp_pos_desc: e.emp_pos ? posMap.get(e.emp_pos) ?? null : null,
      emp_loc_desc: e.emp_loc ? locMap.get(e.emp_loc) ?? null : null,
      has_salary: hasSalary.has(e.emp_id),
    }))

    return NextResponse.json(paginate(enriched, total, page, limit))
  } catch (error) {
    console.error("Get employee list error:", error)
    return NextResponse.json(
      { message: "Internal server error", error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
