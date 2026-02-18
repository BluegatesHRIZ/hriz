import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt-edge";
import * as requestProcedures from "@/lib/services/requests.service";
import { prisma } from "@/lib/db/prisma";
import { beforeAfterLead } from "@/lib/utils/requestLimit";

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
      await verifyToken(authHeader.substring(7));
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

    // Get leave types for validation (per-employee)
    const leaveTypes = await requestProcedures.getLeaveTypes(empId);
    const leaveSettings = leaveTypes.find((lt: any) => lt.lev_id === LeaStype);

    if (!leaveSettings) {
      return NextResponse.json(
        { message: "Leave detail is invalid" },
        { status: 400 }
      );
    }

    // Validate start date with BeforeAfterLead (matches C# validation)
    if (
      beforeAfterLead(
        new Date(LeaSfrom),
        leaveSettings.lev_before ?? 0,
        leaveSettings.lev_after ?? 0,
        leaveSettings.lev_lead ?? 0
      )
    ) {
      return NextResponse.json(
        { message: "Leave date is not allowed" },
        { status: 400 }
      );
    }

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
        // Validate each detail date with BeforeAfterLead (matches C# validation)
        if (
          beforeAfterLead(
            new Date(detail.LeaDdate),
            leaveSettings.lev_before ?? 0,
            leaveSettings.lev_after ?? 0,
            leaveSettings.lev_lead ?? 0
          )
        ) {
          return NextResponse.json(
            { message: "Leave date is not allowed" },
            { status: 400 }
          );
        }

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

    // Verify forapproval records were created
    const approvalRecords = await prisma.forapproval.findMany({
      where: { fa_taskid: leaveSummaryId },
    });
    console.log(
      `Create leave summary: Created leave "${leaveSummaryId}" for employee "${empId}". ` +
      `Found ${approvalRecords.length} forapproval records.`
    );
    if (approvalRecords.length === 0) {
      console.warn(
        `Create leave summary: WARNING - No forapproval records found for leave "${leaveSummaryId}". ` +
        `This means approval levels may not be configured for employee "${empId}".`
      );
    }

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
