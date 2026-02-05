import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { verifyToken } from "@/lib/auth/jwt-edge"

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
    
    const employees = await prisma.employee.findMany({
      where: {
        emp_status: 1, // Only active employees
      },
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
    })

    return NextResponse.json(employees)
  } catch (error) {
    console.error("Get employee list error:", error)
    return NextResponse.json(
      { message: "Internal server error", error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
