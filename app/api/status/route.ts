import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { verifyToken } from "@/lib/auth/jwt";
import { serializeForJson } from "@/lib/utils";

/**
 * GET /api/status
 * Get user status (overtime, undertime, late, absences, leave credits)
 * Ported from StatusController.GetStatusMinutes and GetLeaveCredit
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const decoded = verifyToken(authHeader.substring(7));
    const empId = decoded.name;

    if (!empId) {
      return NextResponse.json(
        { message: "Employee ID not found" },
        { status: 400 }
      );
    }

    const { displayStatusMinutes } = await import(
      "@/lib/services/status.service"
    );
    const statusMinutesResult = await displayStatusMinutes(empId);

    // Transform statusMinutes to match component expectations
    // Component expects: Overtime (hrs), Undertime (hrs), Late (times), Absences (days)
    const statusMinutes = {
      Overtime: statusMinutesResult
        ? Math.round(
            ((statusMinutesResult.otm_current || 0) +
              (statusMinutesResult.otm_previous || 0)) /
              60
          )
        : 0,
      Undertime: statusMinutesResult
        ? Math.round(
            ((statusMinutesResult.utm_current || 0) +
              (statusMinutesResult.utm_previous || 0)) /
              60
          )
        : 0,
      Late: statusMinutesResult ? Math.round(statusMinutesResult.late_current || 0) : 0,
      Absences: statusMinutesResult ? (statusMinutesResult.absents || 0) : 0,
    };

    // Get leave credits
    const leaveCredits = await prisma.empleave.findMany({
      where: {
        eml_emp: empId,
      },
    });

    // Get leave descriptions
    const leaveIds = leaveCredits
      .map((c) => c.eml_leave)
      .filter(Boolean) as string[];
    const leaves =
      leaveIds.length > 0
        ? await prisma.leave.findMany({
            where: { lev_id: { in: leaveIds } },
            select: { lev_id: true, lev_desc: true },
          })
        : [];
    const leaveMap = new Map(leaves.map((l) => [l.lev_id, l.lev_desc]));

    // Compute balance for each leave credit and format for component
    const leaveCreditsWithBalance = leaveCredits.map((credit) => ({
      el_leave:
        credit.eml_leave && leaveMap.has(credit.eml_leave)
          ? leaveMap.get(credit.eml_leave) ?? null
          : credit.eml_leave ?? null,
      el_credit: credit.eml_leacredit ?? 0,
      el_used: credit.eml_used ?? 0,
      el_balance: (credit.eml_leacredit || 0) - (credit.eml_used || 0),
    }));

    return NextResponse.json(
      serializeForJson({
        statusMinutes,
        leaveCredits: leaveCreditsWithBalance || [],
      })
    );
  } catch (error) {
    console.error("Get status error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
