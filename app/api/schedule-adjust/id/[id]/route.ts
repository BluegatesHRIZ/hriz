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
    const scaId = resolvedParams.id;
    const username = payload.name; // EmpId from JWT payload

    const schedAdjust = await prisma.schedadjust_summary.findFirst({
      where: {
        sca_sid: scaId,
        sca_semp: username,
      },
    });

    if (!schedAdjust) {
      return NextResponse.json(
        { message: "Schedule adjustment not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(schedAdjust);
  } catch (error) {
    console.error("Get schedule adjust error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
