import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt-edge";
import { prisma } from "@/lib/db/prisma";
import { formatTimeForInput } from "@/lib/utils/time";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ coa_sid: string }> }
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
    const coaSid = resolvedParams.coa_sid;

    const summary = await prisma.coa_summary.findFirst({
      where: {
        coa_sid: coaSid,
      },
    });

    if (!summary) {
      return NextResponse.json({ message: "COA not found" }, { status: 404 });
    }

    // Get COA type details
    const coaType = summary.coa_stype
      ? await prisma.coa_type.findFirst({
          where: { coa_tid: summary.coa_stype },
        })
      : null;

    const details = await prisma.coa_detail.findMany({
      where: {
        coa_dpk: coaSid,
      },
      orderBy: {
        coa_ddate: "asc",
      },
    });

    return NextResponse.json({
      CoaSid: summary.coa_sid,
      CoaSemp: summary.coa_semp,
      CoaStype: summary.coa_stype,
      CoaStypedetail: summary.coa_stypedetail,
      CoaSreason: summary.coa_sreason,
      CoaSstatus: summary.coa_sstatus,
      CoaSapproveddate: summary.coa_sapproveddate,
      CoaSapprovedby: summary.coa_sapprovedby,
      CoaStypeNavigation: coaType
        ? {
            CoaTdesc: coaType.coa_tdesc,
            CoaTtag: coaType.coa_ttag,
          }
        : null,
      CoaDetails: details.map((detail) => ({
        CoaDdate: detail.coa_ddate,
        CoaDtime: formatTimeForInput(detail.coa_dtime), // Format as "HH:mm" string to avoid timezone issues
        CoaDtype: detail.coa_dtype,
      })),
    });
  } catch (error) {
    console.error("Get COA for approval error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
