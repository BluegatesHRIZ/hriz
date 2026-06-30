import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { verifyToken } from "@/lib/auth/jwt-edge"
import { parsePagination, paginate } from "@/lib/pagination"

/**
 * GET /api/employee/list/all
 * List all employees (for display in Employee List)
 * Ported from EmployeeController.GetEmployeeList
 */
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
    
    const { page, limit, skip, take } = parsePagination(request.nextUrl.searchParams)

    const where = { emp_status: 1 } // Only active employees
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

    // Enrich codes with human-readable descriptions from the lookup tables
    const [departments, positions, locations] = await Promise.all([
      prisma.department.findMany({ select: { dep_id: true, dep_desc: true } }),
      prisma.position.findMany({ select: { pst_id: true, pst_desc: true } }),
      prisma.location.findMany({ select: { loc_id: true, loc_desc: true } }),
    ])
    const depMap = new Map(departments.map((d) => [d.dep_id, d.dep_desc]))
    const posMap = new Map(positions.map((p) => [p.pst_id, p.pst_desc]))
    const locMap = new Map(locations.map((l) => [l.loc_id, l.loc_desc]))

    const enriched = employees.map((e) => ({
      ...e,
      emp_dept_desc: e.emp_dept ? depMap.get(e.emp_dept) ?? null : null,
      emp_pos_desc: e.emp_pos ? posMap.get(e.emp_pos) ?? null : null,
      emp_loc_desc: e.emp_loc ? locMap.get(e.emp_loc) ?? null : null,
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
