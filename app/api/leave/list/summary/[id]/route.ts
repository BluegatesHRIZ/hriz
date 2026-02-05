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

    let payload;
    try {
      payload = await verifyToken(authHeader.substring(7));
    } catch {
      return NextResponse.json({ message: "Invalid token" }, { status: 401 });
    }

    const resolvedParams = await params;
    const leaveId = resolvedParams.id;
    const username = payload.name; // EmpId from JWT payload

    const leaveSummary = await prisma.leave_summary.findFirst({
      where: {
        lea_sid: leaveId,
        lea_semp: username,
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
    console.error("Get leave summary error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
