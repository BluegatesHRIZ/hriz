import { NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/auth/jwt"
import { prisma } from "@/lib/db/prisma"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  try {
    const authHeader = request.headers.get("authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    let payload
    try {
      payload = verifyToken(authHeader.substring(7))
    } catch {
      return NextResponse.json({ message: "Invalid token" }, { status: 401 })
    }

    const resolvedParams = await params
    const dateStr = resolvedParams.date
    const username = payload.name // EmpId from JWT payload

    const attendances = await prisma.attendance.findMany({
      where: {
        att_date: new Date(dateStr),
        att_emp: username,
      },
    })

    return NextResponse.json(attendances || [])
  } catch (error) {
    console.error("Get overtime attendance error:", error)
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
