import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { verifyToken } from "@/lib/auth/jwt-edge"
import { parsePagination, paginate } from "@/lib/pagination"

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

    const dateParam = request.nextUrl.searchParams.get("date")
    const today = dateParam
      ? new Date(dateParam + "T00:00:00.000Z")
      : (() => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); return d })()


    const allActive = await prisma.announce.findMany({
      where: {
        an_status: 1,
        an_startdate: {
          lte: today,
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

    const { page, limit, skip, take } = parsePagination(request.nextUrl.searchParams)

    const announcements = allActive.filter((a) => {
      const repeat = a.an_repeat ?? 0
      const start = a.an_startdate ? new Date(a.an_startdate) : null
      const end = a.an_enddate ? new Date(a.an_enddate) : null

      switch (repeat) {
        case 0: // Once — must be within date range
          return end ? end >= today : false
        case 1: // Daily — always show once started
          return true
        case 2: // Weekly — show on the same day of the week as startdate
          return start ? today.getUTCDay() === start.getUTCDay() : false
        case 3: // Monthly — show on the same day of the month as startdate
          return start ? today.getUTCDate() === start.getUTCDate() : false
        case 4: // Yearly — show on the same month and day as startdate
          return start
            ? today.getUTCMonth() === start.getUTCMonth() &&
                today.getUTCDate() === start.getUTCDate()
            : false
        default:
          return end ? end >= today : false
      }
    })

    // Recurrence filtering happens in memory, so paginate the resolved list.
    return NextResponse.json(
      paginate(announcements.slice(skip, skip + take), announcements.length, page, limit)
    )
  } catch (error) {
    console.error("Get announcements error:", error)
    return NextResponse.json(
      { message: "Internal server error", error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
