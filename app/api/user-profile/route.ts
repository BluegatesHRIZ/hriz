import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { verifyToken } from "@/lib/auth/jwt"

/**
 * GET /api/user-profile/user
 * Get current user's profile
 * Ported from UserProfileController.GetUserProfile
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

    let payload
    try {
      payload = verifyToken(authHeader.substring(7))
    } catch {
      return NextResponse.json(
        { message: "Invalid token" },
        { status: 401 }
      )
    }

    const userId = payload.name

    // Get employee with related data
    // Note: The C# version includes many relations
    // TODO: Add relations once we verify the schema relationships
    const employee = await prisma.employee.findUnique({
      where: {
        emp_id: userId,
      },
      // include: {
      //   // Add relations here based on Prisma schema
      // },
    })

    if (!employee) {
      return NextResponse.json(
        { message: "Employee not found" },
        { status: 404 }
      )
    }

    // Remove sensitive data
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { emp_pswd: _emp_pswd, ...profileData } = employee

    // TODO: Process approval levels as in C# code
    // TODO: Get profile picture from Files table

    return NextResponse.json(profileData)
  } catch (error) {
    console.error("Get user profile error:", error)
    return NextResponse.json(
      { message: "Internal server error", error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
