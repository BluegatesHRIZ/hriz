import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt";
import { prisma } from "@/lib/db/prisma";

/**
 * POST /api/approval/reason
 * Post approval reason/remark
 * Ported from ForApprovalController.PostApprovalReason
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const decoded = verifyToken(authHeader.substring(7));
    const approverId = decoded.name;

    if (!approverId) {
      return NextResponse.json(
        { message: "Approver ID not found" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { Fap_Appvr, Fap_Reason, Fap_Type, Fap_TaskId } = body;

    if (!Fap_Reason || !Fap_TaskId) {
      return NextResponse.json(
        { message: "Reason and Task ID are required" },
        { status: 400 }
      );
    }

    // Insert approval reason into database
    // Using Prisma direct insert - table structure verified from schema
    await prisma.fapreason.create({
      data: {
        fap_appvr: Fap_Appvr || approverId,
        fap_reason: Fap_Reason,
        fap_type: Fap_Type || "A", // A = Approve, R = Reject/Resend, C = Cancel, U = Update
        fap_taskid: Fap_TaskId,
        fap_datetime: new Date(),
      },
    });

    return NextResponse.json({
      Fap_Appvr: Fap_Appvr || approverId,
      Fap_Reason,
      Fap_Type: Fap_Type || "A",
      Fap_TaskId,
    });
  } catch (error) {
    console.error("Post approval reason error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
