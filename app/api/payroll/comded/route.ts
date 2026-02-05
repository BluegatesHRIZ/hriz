import { NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/auth/jwt-edge"
import { prisma } from "@/lib/db/prisma"

/**
 * GET /api/payroll/comded
 * Get all compensation/deduction types (benefit types)
 */
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

    const comdedList = await prisma.comded.findMany({
      select: {
        cd_code: true,
        cd_desc: true,
        cd_type: true,
        cd_ord: true,
        cd_tax: true,
      },
      orderBy: [
        { cd_type: "asc" },
        { cd_ord: "asc" },
      ],
    })

    return NextResponse.json(comdedList)
  } catch (error) {
    console.error("Get comded list error:", error)
    return NextResponse.json(
      { message: "Internal server error", error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
