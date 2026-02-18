import { NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/auth/jwt-edge"
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
      await verifyToken(authHeader.substring(7))
    } catch {
      return NextResponse.json({ message: "Invalid token" }, { status: 401 })
    }

    const resolvedParams = await params
    const otId = resolvedParams.otid

    const overtime = await prisma.overtime.findFirst({
      where: {
        otm_id: otId,
      },
    })

    if (!overtime) {
      return NextResponse.json({ message: "Overtime request not found" }, { status: 404 })
    }

    return NextResponse.json({
      otm_id: overtime.otm_id,
      otm_emp: overtime.otm_emp,
      otm_type: overtime.otm_type,
      otm_date: overtime.otm_date,
      otm_from: overtime.otm_from,
      otm_to: overtime.otm_to,
      otm_reason: overtime.otm_reason,
      otm_applieddate: overtime.otm_applieddate,
      otm_status: overtime.otm_status,
      otm_approveddate: overtime.otm_approveddate,
      otm_approvedby: overtime.otm_approvedby,
    })
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
