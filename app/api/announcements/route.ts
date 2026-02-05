import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { verifyToken } from "@/lib/auth/jwt-edge"

/**
 * GET /api/announcements
 * Get active announcements
 * Ported from AnnouncementController
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

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const announcements = await prisma.announce.findMany({
      where: {
        an_status: 1,
        an_startdate: {
          lte: today,
        },
        an_enddate: {
          gte: today,
        },
      },
      select: {
        an_id: true,
        an_startdate: true,
        an_enddate: true,
        an_headline: true,
        an_message: true,
        an_repeat: true,
        an_status: true,
        an_type: true,
        an_by: true,
        an_modified: true,
        an_logdate: true,
      },
      orderBy: {
        an_logdate: "desc",
      },
    })

    return NextResponse.json(announcements)
  } catch (error) {
    console.error("Get announcements error:", error)
    return NextResponse.json(
      { message: "Internal server error", error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
