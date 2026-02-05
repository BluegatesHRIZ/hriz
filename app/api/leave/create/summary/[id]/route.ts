import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt";
import * as requestProcedures from "@/lib/services/requests.service";
import { prisma } from "@/lib/db/prisma";

export async function POST(
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
    const empId = resolvedParams.id;
    const body = await request.json();

    const {
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
    // For now, proceed with insertion

    // Insert leave summary
    const leaveSummaryId = await requestProcedures.leaveInsertSummary(
      empId,
      LeaStype,
      new Date(LeaSfrom),
      new Date(LeaSto),
      LeaSreason || "",
      LeaSwithpay || 0,
      LeaSwithoutpay || 0
    );

    // Insert leave details
    if (Array.isArray(leavedetail)) {
      for (const detail of leavedetail) {
        // TODO: Validate date with RequestLimit.BeforeAfterLead
        await requestProcedures.leaveInsertDetails(
          leaveSummaryId,
          new Date(detail.LeaDdate),
          detail.LeaDtype || "",
          detail.LeaDampm || ""
        );
      }
    }

    // Fetch and return the created leave summary
    const createdSummary = await prisma.leave_summary.findUnique({
      where: { lea_sid: leaveSummaryId },
    });

    return NextResponse.json(createdSummary);
  } catch (error) {
    console.error("Create leave summary error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
