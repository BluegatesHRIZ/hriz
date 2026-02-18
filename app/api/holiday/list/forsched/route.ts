import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt-edge";
import { prisma } from "@/lib/db/prisma";

/**
 * GET /api/holiday/list/forsched
 * Get holidays for schedule (matches C# GetHolidaysForSched).
 * Mirrors stored procedure `get_holidays()` - returns holidays for current year.
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    try {
      await verifyToken(authHeader.substring(7));
    } catch {
      return NextResponse.json({ message: "Invalid token" }, { status: 401 });
    }

    const year = new Date().getFullYear();
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59);

    // Get holidays for current year (matches get_holidays SP)
    const holidays = await prisma.holiday.findMany({
      where: {
        hol_date: {
          gte: startOfYear,
          lte: endOfYear,
        },
      },
      select: {
        hol_id: true,
        hol_date: true,
        hol_type: true,
        hol_name: true,
        hol_logdate: true,
        hol_status: true,
        hol_repeat: true,
      },
    });

    return NextResponse.json(holidays);
  } catch (error) {
    console.error("Get holidays for schedule error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
