import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt-edge";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    let payload;
    try {
      payload = await verifyToken(authHeader.substring(7));
    } catch {
      return NextResponse.json({ message: "Invalid token" }, { status: 401 });
    }

    const resolvedParams = await params;
    const leaveId = resolvedParams.id;
    const username = payload.name; // EmpId from JWT payload

    const leaveSummary = await prisma.leave_summary.findFirst({
      where: {
        lea_sid: leaveId,
        lea_semp: username,
      },
    });

    if (!leaveSummary) {
      return NextResponse.json({ message: "Leave not found" }, { status: 404 });
    }

    // Get leave type details
    const leaveType = leaveSummary.lea_stype
      ? await prisma.leave.findFirst({
          where: { lev_id: leaveSummary.lea_stype },
        })
      : null;

    // Get leave details
    const leaveDetails = await prisma.leave_detail.findMany({
      where: {
        lea_dpk: leaveId,
      },
      orderBy: {
        lea_ddate: "asc",
      },
    });

    // Get associated files
    const files = await prisma.files.findMany({
      where: {
        fil_fk: leaveId,
        fil_status: 1,
      },
    });

    return NextResponse.json({
      LeaSid: leaveSummary.lea_sid,
      LeaSemp: leaveSummary.lea_semp,
      LeaStype: leaveSummary.lea_stype,
      LeaSfrom: leaveSummary.lea_sfrom,
      LeaSto: leaveSummary.lea_sto,
      LeaSreason: leaveSummary.lea_sreason,
      LeaSwithpay: leaveSummary.lea_swithpay,
      LeaSwithoutpay: leaveSummary.lea_swithoutpay,
      LeaSapplieddate: leaveSummary.lea_sapplieddate,
      LeaSstatus: leaveSummary.lea_sstatus,
      LeaSapproveddate: leaveSummary.lea_sapproveddate,
      LeaSapprovedby: leaveSummary.lea_sapprovedby,
      LeaStypeDetail: leaveType
        ? {
            LevDesc: leaveType.lev_desc,
            LevId: leaveType.lev_id,
          }
        : null,
      leavedetail: leaveDetails.map((detail) => ({
        LeaDdate: detail.lea_ddate,
        LeaDtype: detail.lea_dtype,
        LeaDampm: detail.lea_dampm,
      })),
      files: files.map((file) => ({
        fil_name: file.fil_name,
        fil_path: file.fil_path,
      })),
    });
  } catch (error) {
    console.error("Get leave summary error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
