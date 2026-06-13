import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt-edge";
import { approvalStatus } from "@/lib/services/approval.service";
import { prisma } from "@/lib/db/prisma";

const STATUS_LABEL: Record<number, string> = { 1: "approved", 2: "rejected", 4: "returned for revision" };
const MODULE_LABEL: Record<string, string> = {
  L001: "Leave", OT01: "Overtime", UT01: "Undertime", CA01: "COA", SC01: "Schedule Adjustment", LN01: "Loan",
};

/**
 * PUT /api/approval/{status}
 * Approve, reject, or resend requests
 * Status: 1 = Approve, 2 = Reject, 4 = Resend
 * Ported from ForApprovalController.StatusChange
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ status: string }> }
) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const decoded = await verifyToken(authHeader.substring(7));
    const approverId = decoded.name;

    if (!approverId) {
      return NextResponse.json(
        { message: "Approver ID not found" },
        { status: 400 }
      );
    }

    // In Next.js 15+, params is a Promise - await it
    const { status: statusParam } = await params;
    const status = parseInt(statusParam);
    if (![1, 2, 4].includes(status)) {
      return NextResponse.json(
        {
          message:
            "Invalid status. Must be 1 (Approve), 2 (Reject), or 4 (Resend)",
        },
        { status: 400 }
      );
    }

    const approvals = (await request.json()) as Array<{
      mod_id: string;
      emp_id: string;
      appvr_id: string;
      module: string;
      [key: string]: any;
    }>;

    if (!Array.isArray(approvals) || approvals.length === 0) {
      return NextResponse.json(
        { message: "No approvals provided" },
        { status: 400 }
      );
    }

    const processedIds: string[] = [];

    for (const approval of approvals) {
      // Call ApprovalStatus stored procedure
      const result = await approvalStatus({
        taskId: approval.mod_id,
        employee: approval.emp_id,
        approver: approval.appvr_id,
        appStatus: status,
      });

      // Check if this is the last approver (result.isLastApprove)
      // If so, update the request status in the respective module table
      // This logic is complex and module-specific, so we'll handle it per module type

      processedIds.push(approval.mod_id);

      // Notify the requesting employee
      try {
        const moduleName = MODULE_LABEL[approval.module] ?? approval.module ?? "Request";
        const actionLabel = STATUS_LABEL[status] ?? "updated";
        await prisma.notification.create({
          data: {
            not_emp: approval.emp_id,
            not_title: `${moduleName} ${actionLabel}`,
            not_desc: `Your ${moduleName.toLowerCase()} request has been ${actionLabel}.`,
            not_status: 0,
            not_createdby: approverId,
          },
        });
      } catch {
        // Non-critical — don't fail the approval if notification insert fails
      }
    }

    return NextResponse.json(processedIds);
  } catch (error) {
    console.error("Approval status change error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
