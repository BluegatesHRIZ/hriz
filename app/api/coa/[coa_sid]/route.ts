import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt";
import { prisma } from "@/lib/db/prisma";
import * as requestProcedures from "@/lib/services/requests.service";
import { removeSeconds } from "@/lib/utils/time";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ coa_sid: string }> }
) {
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

    const resolvedParams = await params;
    const coaSid = resolvedParams.coa_sid;
    const username = payload.name; // EmpId from JWT payload

    const summary = await prisma.coa_summary.findFirst({
      where: {
        coa_sid: coaSid,
        coa_semp: username,
      },
    });

    if (!summary) {
      return NextResponse.json({ message: "COA not found" }, { status: 404 });
    }

    const details = await prisma.coa_detail.findMany({
      where: {
        coa_dpk: coaSid,
      },
    });

    return NextResponse.json({
      ...summary,
      CoaDetails: details,
    });
  } catch (error) {
    console.error("Get COA error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ coa_sid: string }> }
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
    const coaSid = resolvedParams.coa_sid;
    const body = await request.json();

    const { CoaStype, CoaStypedetail, CoaSreason, CoaDetails } = body;

    // Get settings for validation
    const settings = await prisma.settings_tab.findFirst();

    // Update COA summary
    await requestProcedures.coaSummaryUpdate(
      coaSid,
      CoaStype,
      CoaStypedetail || "",
      CoaSreason || ""
    );

    // Delete existing details
    await prisma.coa_detail.deleteMany({
      where: { coa_dpk: coaSid },
    });

    // Insert new details
    if (Array.isArray(CoaDetails)) {
      for (const detail of CoaDetails) {
        if (settings) {
          // TODO: Implement RequestLimit.BeforeAfter validation
        }

        const filteredTime = removeSeconds(new Date(detail.CoaDtime));
        await requestProcedures.coaDetailsInsert(
          coaSid,
          detail.CoaDtype,
          new Date(detail.CoaDdate),
          filteredTime
        );
      }
    }

    return NextResponse.json(body);
  } catch (error) {
    console.error("Update COA error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
