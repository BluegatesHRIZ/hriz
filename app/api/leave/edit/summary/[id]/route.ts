import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt";
import * as requestProcedures from "@/lib/services/requests.service";
import { prisma } from "@/lib/db/prisma";

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
    const leaveId = resolvedParams.id;
    const body = await request.json();

    const {
      LeaSemp,
      LeaStype,
      LeaSfrom,
      LeaSto,
      LeaSreason,
      LeaSwithpay,
      LeaSwithoutpay,
      leavedetail,
    } = body;

    // Validate dates
    if (new Date(LeaSto) < new Date(LeaSfrom)) {
      return NextResponse.json(
        { message: "Leave date is invalid" },
        { status: 400 }
      );
    }

    // Get leave types for validation
    const leaveTypes = await requestProcedures.getLeaveTypes();
    const leaveSettings = leaveTypes.find((lt: any) => lt.lev_id === LeaStype);

    if (!leaveSettings) {
      return NextResponse.json(
        { message: "Leave detail is invalid" },
        { status: 400 }
      );
    }

    // TODO: Implement RequestLimit.BeforeAfterLead validation

    // Update leave summary
    await requestProcedures.leaveUpdateSummary(
      leaveId,
      LeaStype,
      new Date(LeaSfrom),
      new Date(LeaSto),
      LeaSreason || "",
      LeaSwithpay || 0,
      LeaSwithoutpay || 0
    );

    // Delete existing leave details
    await prisma.leave_detail.deleteMany({
      where: { lea_dpk: leaveId },
    });

    // Insert new leave details
    if (Array.isArray(leavedetail)) {
      for (const detail of leavedetail) {
        // TODO: Validate date with RequestLimit.BeforeAfterLead
        await requestProcedures.leaveInsertDetails(
          leaveId,
          new Date(detail.LeaDdate),
          detail.LeaDtype || "",
          detail.LeaDampm || ""
        );
      }
    }

    return NextResponse.json(body);
  } catch (error) {
    console.error("Update leave summary error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
