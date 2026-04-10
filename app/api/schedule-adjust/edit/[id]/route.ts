import { NextRequest, NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/auth/authorization";
import * as requestProcedures from "@/lib/services/requests.service";
import { prisma } from "@/lib/db/prisma";
import { beforeAfter } from "@/lib/utils/requestLimit";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authorizeApiRequest(request, "apiScheduleChange");
    if (!auth.ok) return auth.response;

    const resolvedParams = await params;
    const scaId = resolvedParams.id;
    const body = await request.json();

    const { ScaSdatefrom, ScaSdateto, ScaSreason, SchedDetail } = body;

    // Get settings for validation
    const settings = await prisma.settings_tab.findFirst();

    // Validate dates (legacy RequestLimit.After behavior using set_scaafter)
    if (Array.isArray(SchedDetail)) {
      for (const detail of SchedDetail) {
        if (settings && detail.ScaDdate) {
          if (
            beforeAfter(
              new Date(detail.ScaDdate),
              0,
              settings.set_scaafter ?? 0,
            )
          ) {
            return NextResponse.json(
              { message: "Schedule Change date is not allowed" },
              { status: 400 },
            );
          }
        }
      }
    }

    // Update schedule adjustment summary
    await requestProcedures.scheduleUpdateSummary(
      scaId,
      new Date(ScaSdatefrom),
      new Date(ScaSdateto),
      ScaSreason || ""
    );

    // Delete existing details
    await prisma.schedadjust_detail.deleteMany({
      where: { sca_dpk: scaId },
    });

    // Insert new details
    if (Array.isArray(SchedDetail)) {
      for (const detail of SchedDetail) {
        await requestProcedures.schedAdjustInsertDetails(
          scaId,
          new Date(detail.ScaDdate),
          new Date(detail.ScaDshiftstart),
          new Date(detail.ScaDbreakstart),
          new Date(detail.ScaDbreakend),
          new Date(detail.ScaDshiftend),
          detail.ScaDrest || 0,
          detail.ScaDbreak || 0,
          detail.ScaDShift || 0
        );
      }
    }

    return NextResponse.json(body);
  } catch (error) {
    console.error("Update schedule adjustment error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
