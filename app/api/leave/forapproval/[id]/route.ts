import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt-edge";
import { prisma } from "@/lib/db/prisma";

export async function GET(
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
    const leaveId = resolvedParams.id;

    const leaveSummary = await prisma.leave_summary.findFirst({
      where: {
        lea_sid: leaveId,
      },
    });

    if (!leaveSummary) {
      return NextResponse.json({ message: "Leave not found" }, { status: 404 });
    }

    // Get associated files
    const files = await prisma.files.findMany({
      where: {
        fil_fk: leaveId,
        fil_status: 1,
      },
    });

    return NextResponse.json({
      ...leaveSummary,
      files,
    });
  } catch (error) {
    console.error("Get leave for approval error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
