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

    try {
      await verifyToken(authHeader.substring(7));
    } catch {
      return NextResponse.json({ message: "Invalid token" }, { status: 401 });
    }

    const resolvedParams = await params;
    const scaId = resolvedParams.id;

    const schedAdjust = await prisma.schedadjust_summary.findFirst({
      where: {
        sca_sid: scaId,
      },
    });

    if (!schedAdjust) {
      return NextResponse.json(
        { message: "Schedule adjustment not found" },
        { status: 404 }
      );
    }

    // Get schedule details
    const schedDetails = await prisma.schedadjust_detail.findMany({
      where: {
        sca_dpk: scaId,
      },
      orderBy: {
        sca_ddate: "asc",
      },
    });

    return NextResponse.json({
      ScaSid: schedAdjust.sca_sid,
      ScaSemp: schedAdjust.sca_semp,
      ScaSdatefrom: schedAdjust.sca_sdatefrom,
      ScaSdateto: schedAdjust.sca_sdateto,
      ScaSreason: schedAdjust.sca_sreason,
      ScaSstatus: schedAdjust.sca_sstatus,
      ScaSapproveddate: schedAdjust.sca_sapproveddate,
      ScaSapprovedby: schedAdjust.sca_sapprovedby,
      SchedDetail: schedDetails.map((detail) => ({
        ScaDdate: detail.sca_ddate,
        ScaDshiftstart: detail.sca_dshiftstart,
        ScaDbreakstart: detail.sca_dbreakstart,
        ScaDbreakend: detail.sca_dbreakend,
        ScaDshiftend: detail.sca_dshiftend,
        ScaDrest: detail.sca_drest,
      })),
    });
  } catch (error) {
    console.error("Get schedule adjust for approval error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
