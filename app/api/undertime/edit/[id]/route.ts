import { NextRequest, NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/auth/authorization";
import * as requestProcedures from "@/lib/services/requests.service";
import { prisma } from "@/lib/db/prisma";
import { removeSeconds } from "@/lib/utils/time";
import { beforeAfter } from "@/lib/utils/requestLimit";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authorizeApiRequest(request, "apiUndertime");
    if (!auth.ok) return auth.response;

    const resolvedParams = await params;
    const utId = resolvedParams.id;
    const body = await request.json();

    const { UtmDate, UtmFrom, UtmTo, UtmReason } = body;

    // Get settings for validation
    const settings = await prisma.settings_tab.findFirst();

    if (
      settings &&
      beforeAfter(
        new Date(UtmDate),
        settings.set_utmlead ?? 0,
        settings.set_utmafter ?? 0,
      )
    ) {
      return NextResponse.json(
        { message: "Undertime date is not allowed" },
        { status: 400 },
      );
    }

    const filteredTimeFrom = removeSeconds(new Date(UtmFrom));
    const filteredTimeTo = removeSeconds(new Date(UtmTo));

    // Update undertime summary
    await requestProcedures.undertimeUpdateSummary(
      utId,
      new Date(UtmDate),
      filteredTimeFrom,
      filteredTimeTo,
      UtmReason || ""
    );

    return NextResponse.json(body);
  } catch (error) {
    console.error("Update undertime error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
