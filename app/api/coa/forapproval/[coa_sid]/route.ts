import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt-edge";
import { prisma } from "@/lib/db/prisma";

export async function GET(
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

    const summary = await prisma.coa_summary.findFirst({
      where: {
        coa_sid: coaSid,
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
    console.error("Get COA for approval error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
