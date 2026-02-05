import { NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/auth/jwt"
import { prisma } from "@/lib/db/prisma"

/**
 * GET /api/employee/locations
 * Get list of locations
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    try {
      verifyToken(authHeader.substring(7))
    } catch {
      return NextResponse.json({ message: "Invalid token" }, { status: 401 })
    }

    const locations = await prisma.location.findMany({
      where: {
        loc_status: 1, // Only active locations
      },
      select: {
        loc_id: true,
        loc_desc: true,
      },
      orderBy: {
        loc_desc: "asc",
      },
    })

    return NextResponse.json(locations)
  } catch (error) {
    console.error("Get locations error:", error)
    return NextResponse.json(
      { message: "Internal server error", error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
