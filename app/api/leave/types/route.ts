import { NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/auth/jwt-edge"
import { prisma } from "@/lib/db/prisma"

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

    const leaveTypes = await prisma.leave.findMany({
      where: {
        lev_status: { not: 0 },
      },
    })

    return NextResponse.json(leaveTypes)
  } catch (error) {
    console.error("Get leave types error:", error)
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
