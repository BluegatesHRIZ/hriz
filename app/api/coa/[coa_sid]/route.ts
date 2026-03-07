import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt-edge";
import { prisma } from "@/lib/db/prisma";
import * as requestProcedures from "@/lib/services/requests.service";
import { removeSeconds, formatTimeForInput } from "@/lib/utils/time";
import { beforeAfter } from "@/lib/utils/requestLimit";

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
      payload = await verifyToken(authHeader.substring(7));
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

    // Transform Prisma snake_case to camelCase to match frontend expectations
    // Format TIME fields to HH:mm strings to avoid timezone issues
    const transformedDetails = details.map((detail) => ({
      CoaDdate: detail.coa_ddate,
      CoaDtime: formatTimeForInput(detail.coa_dtime), // Format as "HH:mm" string
      CoaDtype: detail.coa_dtype,
    }));

    // Transform summary fields to camelCase
    const transformedSummary = {
      CoaSid: summary.coa_sid,
      CoaStype: summary.coa_stype,
      CoaStypedetail: summary.coa_stypedetail,
      CoaSreason: summary.coa_sreason,
      CoaSemp: summary.coa_semp,
      CoaSapplieddate: summary.coa_sapplieddate,
      CoaSstatus: summary.coa_sstatus,
      CoaSapprovedby: summary.coa_sapprovedby,
      CoaSapproveddate: summary.coa_sapproveddate,
    };

    return NextResponse.json({
      ...transformedSummary,
      CoaDetails: transformedDetails,
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
      await verifyToken(authHeader.substring(7));
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
        // Validate date with BeforeAfter (matches C# validation)
        if (settings) {
          const detailDate = new Date(detail.CoaDdate);
          if (
            beforeAfter(
              detailDate,
              settings.set_coabefore ?? 0,
              settings.set_coaafter ?? 0
            )
          ) {
            return NextResponse.json(
              { message: "Attendance change date is not allowed" },
              { status: 400 }
            );
          }
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
