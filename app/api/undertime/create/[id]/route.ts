import { NextRequest, NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/auth/authorization";
import * as requestProcedures from "@/lib/services/requests.service";
import { prisma } from "@/lib/db/prisma";
import { removeSeconds } from "@/lib/utils/time";
import { beforeAfter } from "@/lib/utils/requestLimit";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authorizeApiRequest(request, "apiUndertime");
    if (!auth.ok) return auth.response;

    const resolvedParams = await params;
    const empId = resolvedParams.id;
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

    // Filter seconds from time
    const filteredTimeFrom = removeSeconds(new Date(UtmFrom));
    const filteredTimeTo = removeSeconds(new Date(UtmTo));

    // Insert undertime summary
    await requestProcedures.undertimeInsertSummary(
      empId,
      new Date(UtmDate),
      filteredTimeFrom,
      filteredTimeTo,
      UtmReason || ""
    );

    const { data } = await requestProcedures.displayGrid("UNT", empId);
    return NextResponse.json(data?.[0] ?? body);
  } catch (error) {
    console.error("Create undertime error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
