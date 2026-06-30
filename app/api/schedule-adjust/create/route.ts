import { NextRequest, NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/auth/authorization";
import * as requestProcedures from "@/lib/services/requests.service";
import { prisma } from "@/lib/db/prisma";
import { beforeAfter } from "@/lib/utils/requestLimit";

export async function POST(request: NextRequest) {
  try {
    const auth = await authorizeApiRequest(request, "apiScheduleChange");
    if (!auth.ok) return auth.response;
    const payload = auth.payload;

    const body = await request.json();
    const { ScaSdatefrom, ScaSdateto, ScaSreason, SchedDetail } = body;

    const username = payload.name; // EmpId from JWT payload

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

    // Insert schedule adjustment summary
    const scaId = await requestProcedures.schedAdjustInsertSummary(
      new Date(ScaSdatefrom),
      new Date(ScaSdateto),
      ScaSreason || "",
      username
    );

    // Insert schedule adjustment details
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

    const { data } = await requestProcedures.displayGrid("SCA", username);
    return NextResponse.json(data?.[0] ?? body);
  } catch (error) {
    console.error("Create schedule adjustment error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
