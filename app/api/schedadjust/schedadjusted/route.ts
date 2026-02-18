import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt-edge";
import { prisma } from "@/lib/db/prisma";

/**
 * POST /api/schedadjust/schedadjusted
 * Get schedule adjusted dates for date range (matches C# GetSchedAdjustedDate).
 * Mirrors stored procedure `get_schedadjusted_date(@_employee, @_date_from, @_date_to)`.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const decoded = await verifyToken(authHeader.substring(7));
    const empId = decoded.name;

    if (!empId) {
      return NextResponse.json(
        { message: "Employee ID not found" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { date_from, date_to } = body;

    if (!date_from || !date_to) {
      return NextResponse.json(
        { message: "date_from and date_to are required" },
        { status: 400 }
      );
    }

    const dateFrom = new Date(date_from);
    const dateTo = new Date(date_to);

    // Get schedule adjusted dates (matches get_schedadjusted_date SP)
    const summaries = await prisma.schedadjust_summary.findMany({
      where: {
        sca_semp: empId,
        sca_sstatus: 1, // Approved status
      },
      select: { sca_sid: true },
    });

    const summaryIds = summaries.map((s) => s.sca_sid).filter(Boolean) as string[];
    if (summaryIds.length === 0) {
      return NextResponse.json([]);
    }

    const details = await prisma.schedadjust_detail.findMany({
      where: {
        sca_dpk: { in: summaryIds },
        sca_ddate: {
          gte: dateFrom,
          lte: dateTo,
        },
      },
      select: {
        sca_dpk: true,
        sca_did: true,
        sca_ddate: true,
        sca_dshiftstart: true,
        sca_dbreakstart: true,
        sca_dbreakend: true,
        sca_dshiftend: true,
        sca_drest: true,
      },
    });

    return NextResponse.json(details);
  } catch (error) {
    console.error("Get schedule adjusted dates error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
