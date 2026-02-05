import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt";
import * as requestProcedures from "@/lib/services/requests.service";
import { prisma } from "@/lib/db/prisma";
import { removeSeconds } from "@/lib/utils/time";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    try {
      verifyToken(authHeader.substring(7));
    } catch {
      return NextResponse.json({ message: "Invalid token" }, { status: 401 });
    }

    const resolvedParams = await params;
    const utId = resolvedParams.id;
    const body = await request.json();

    const { UtmDate, UtmFrom, UtmTo, UtmReason } = body;

    // Get settings for validation
    const settings = await prisma.settings_tab.findFirst();

    // TODO: Implement RequestLimit.LeadAfter validation

    // Update undertime summary
    await requestProcedures.undertimeUpdateSummary(
      utId,
      new Date(UtmDate),
      new Date(UtmFrom),
      new Date(UtmTo),
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
