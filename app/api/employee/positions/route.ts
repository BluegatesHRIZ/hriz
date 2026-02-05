import { NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/auth/jwt-edge"
import { prisma } from "@/lib/db/prisma"

/**
 * GET /api/employee/positions
 * Get list of positions
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

    const positions = await prisma.position.findMany({
      where: {
        pst_Status: 1, // Only active positions (note: capital S in schema)
      },
      select: {
        pst_id: true,
        pst_desc: true,
      },
      orderBy: {
        pst_desc: "asc",
      },
    })

    return NextResponse.json(positions)
  } catch (error) {
    console.error("Get positions error:", error)
    return NextResponse.json(
      { message: "Internal server error", error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
