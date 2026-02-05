import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt";
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
      verifyToken(authHeader.substring(7));
    } catch {
      return NextResponse.json({ message: "Invalid token" }, { status: 401 });
    }

    const resolvedParams = await params;
    const empId = resolvedParams.id;

    const leaves = await prisma.leave_summary.findMany({
      where: {
        lea_semp: empId,
      },
      orderBy: {
        lea_sapplieddate: "desc",
      },
    });

    return NextResponse.json(leaves);
  } catch (error) {
    console.error("Get user leaves error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
