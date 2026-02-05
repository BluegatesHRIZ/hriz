import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt";
import * as requestProcedures from "@/lib/services/requests.service";
import { prisma } from "@/lib/db/prisma";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    let payload;
    try {
      payload = verifyToken(authHeader.substring(7));
    } catch {
      return NextResponse.json({ message: "Invalid token" }, { status: 401 });
    }

    const body = await request.json();
    const { ScaSdatefrom, ScaSdateto, ScaSreason, SchedDetail } = body;

    const username = payload.name; // EmpId from JWT payload

    // Get settings for validation
    const settings = await prisma.settings_tab.findFirst();

    // Validate dates
    if (Array.isArray(SchedDetail)) {
      for (const detail of SchedDetail) {
        if (settings && detail.ScaDdate) {
          // TODO: Implement RequestLimit.After validation
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

    return NextResponse.json(body);
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
