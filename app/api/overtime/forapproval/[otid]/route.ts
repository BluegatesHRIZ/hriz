import { NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/auth/jwt"
import { prisma } from "@/lib/db/prisma"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ otid: string }> }
) {
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

    const resolvedParams = await params
    const otId = resolvedParams.otid

    const overtime = await prisma.overtime.findMany({
      where: {
        otm_id: otId,
      },
    })

    if (!overtime || overtime.length === 0) {
      return NextResponse.json({ message: "Overtime request not found" }, { status: 404 })
    }

    return NextResponse.json(overtime)
  } catch (error) {
    console.error("Get overtime for approval error:", error)
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
