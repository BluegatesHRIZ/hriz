import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { verifyToken } from "@/lib/auth/jwt-edge";
import { serializeForJson } from "@/lib/utils";

/**
 * GET /api/requests/stats
 * Get request statistics (totals and by module)
 * Mirrors get_total_req and get_request_mod stored procedures
 */
export async function GET(request: NextRequest) {
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

    // Mirror get_total_req SP: get totals by type
    const [
      approvedLeave,
      approvedCoa,
      approvedUt,
      approvedOt,
      pendingLeave,
      pendingCoa,
      pendingUt,
      pendingOt,
      resendedLeave,
      resendedCoa,
      resendedUt,
      resendedOt,
      cancelledLeave,
      cancelledCoa,
      cancelledUt,
      cancelledOt,
      rejectedLeave,
      rejectedCoa,
      rejectedUt,
      rejectedOt,
    ] = await Promise.all([
      prisma.leave_summary.count({
        where: { lea_semp: empId, lea_sstatus: 1 },
      }),
      prisma.coa_summary.count({
        where: { coa_semp: empId, coa_sstatus: 1 },
      }),
      prisma.undertime.count({
        where: { utm_emp: empId, utm_status: 1 },
      }),
      prisma.overtime.count({
        where: { otm_emp: empId, otm_status: 1 },
      }),
      prisma.leave_summary.count({
        where: { lea_semp: empId, lea_sstatus: 0 },
      }),
      prisma.coa_summary.count({
        where: { coa_semp: empId, coa_sstatus: 0 },
      }),
      prisma.undertime.count({
        where: { utm_emp: empId, utm_status: 0 },
      }),
      prisma.overtime.count({
        where: { otm_emp: empId, otm_status: 0 },
      }),
      prisma.leave_summary.count({
        where: { lea_semp: empId, lea_sstatus: 4 },
      }),
      prisma.coa_summary.count({
        where: { coa_semp: empId, coa_sstatus: 4 },
      }),
      prisma.undertime.count({
        where: { utm_emp: empId, utm_status: 4 },
      }),
      prisma.overtime.count({
        where: { otm_emp: empId, otm_status: 4 },
      }),
      prisma.leave_summary.count({
        where: { lea_semp: empId, lea_sstatus: 3 },
      }),
      prisma.coa_summary.count({
        where: { coa_semp: empId, coa_sstatus: 3 },
      }),
      prisma.undertime.count({
        where: { utm_emp: empId, utm_status: 3 },
      }),
      prisma.overtime.count({
        where: { otm_emp: empId, otm_status: 3 },
      }),
      prisma.leave_summary.count({
        where: { lea_semp: empId, lea_sstatus: 2 },
      }),
      prisma.coa_summary.count({
        where: { coa_semp: empId, coa_sstatus: 2 },
      }),
      prisma.undertime.count({
        where: { utm_emp: empId, utm_status: 2 },
      }),
      prisma.overtime.count({
        where: { otm_emp: empId, otm_status: 2 },
      }),
    ]);

    const totals = [
      {
        type: "approve",
        totals: approvedLeave + approvedCoa + approvedUt + approvedOt,
      },
      {
        type: "pending",
        totals: pendingLeave + pendingCoa + pendingUt + pendingOt,
      },
      {
        type: "resended",
        totals: resendedLeave + resendedCoa + resendedUt + resendedOt,
      },
      {
        type: "canccelled",
        totals: cancelledLeave + cancelledCoa + cancelledUt + cancelledOt,
      },
      {
        type: "rejected",
        totals: rejectedLeave + rejectedCoa + rejectedUt + rejectedOt,
      },
    ];

    // Mirror get_request_mod SP: get stats by module
    const [
      leaveResended,
      coaResended,
      utResended,
      otResended,
      saResended,
    ] = await Promise.all([
      prisma.leave_summary.count({
        where: { lea_semp: empId, lea_sstatus: 4 },
      }),
      prisma.coa_summary.count({
        where: { coa_semp: empId, coa_sstatus: 4 },
      }),
      prisma.undertime.count({
        where: { utm_emp: empId, utm_status: 4 },
      }),
      prisma.overtime.count({
        where: { otm_emp: empId, otm_status: 4 },
      }),
      prisma.schedadjust_summary.count({
        where: { sca_semp: empId, sca_sstatus: 4 },
      }),
    ]);

    const moduleStats = [
      {
        Module: "Leave",
        Pending: pendingLeave,
        Resended: leaveResended,
      },
      {
        Module: "Attendance Change",
        Pending: pendingCoa,
        Resended: coaResended,
      },
      {
        Module: "Undertime",
        Pending: pendingUt,
        Resended: utResended,
      },
      {
        Module: "Overtime",
        Pending: pendingOt,
        Resended: otResended,
      },
      {
        Module: "Schedule Adjustment",
        Pending: await prisma.schedadjust_summary.count({
          where: { sca_semp: empId, sca_sstatus: 0 },
        }),
        Resended: saResended,
      },
    ].filter((m) => m.Pending > 0 || m.Resended > 0);

    // Format totals for the component
    const totalsObj: Record<string, number> = {};
    for (const t of totals) {
      if (t.type === "pending") totalsObj.TotalPending = t.totals;
      if (t.type === "resended") totalsObj.TotalResended = t.totals;
    }

    return NextResponse.json(
      serializeForJson({
        totals: [totalsObj],
        moduleStats,
      })
    );
  } catch (error) {
    console.error("Get request stats error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
