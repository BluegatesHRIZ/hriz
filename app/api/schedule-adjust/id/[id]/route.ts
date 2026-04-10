import { NextRequest, NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authorizeApiRequest(request, "apiScheduleChange");
    if (!auth.ok) return auth.response;
    const payload = auth.payload;

    const resolvedParams = await params;
    const scaId = resolvedParams.id;
    const username = payload.name; // EmpId from JWT payload

    const schedAdjust = await prisma.schedadjust_summary.findFirst({
      where: {
        sca_sid: scaId,
        sca_semp: username,
      },
    });

    if (!schedAdjust) {
      return NextResponse.json(
        { message: "Schedule adjustment not found" },
        { status: 404 }
      );
    }

    const schedDetails = await prisma.schedadjust_detail.findMany({
      where: { sca_dpk: scaId },
      orderBy: { sca_ddate: "asc" },
    });

    return NextResponse.json({
      ScaSid: schedAdjust.sca_sid,
      ScaSemp: schedAdjust.sca_semp,
      ScaSdatefrom: schedAdjust.sca_sdatefrom,
      ScaSdateto: schedAdjust.sca_sdateto,
      ScaSreason: schedAdjust.sca_sreason,
      ScaSstatus: schedAdjust.sca_sstatus,
      ScaSapplieddate: schedAdjust.sca_sapplieddate,
      ScaSapproveddate: schedAdjust.sca_sapproveddate,
      ScaSapprovedby: schedAdjust.sca_sapprovedby,
      SchedDetail: schedDetails.map((detail) => ({
        ScaDdate: detail.sca_ddate,
        ScaDshiftstart: detail.sca_dshiftstart,
        ScaDbreakstart: detail.sca_dbreakstart,
        ScaDbreakend: detail.sca_dbreakend,
        ScaDshiftend: detail.sca_dshiftend,
        ScaDrest: detail.sca_drest,
        ScaDbreak: detail.sca_dbreak,
        ScaDShift: detail.sca_dshift,
      })),
    });
  } catch (error) {
    console.error("Get schedule adjust error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
