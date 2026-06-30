import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt-edge";
import { prisma } from "@/lib/db/prisma";
import { parsePagination, paginate } from "@/lib/pagination";

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
    const empId = resolvedParams.id;
    const { page, limit, skip, take } = parsePagination(request.nextUrl.searchParams);

    const where = { lea_semp: empId };
    const [total, leaves] = await Promise.all([
      prisma.leave_summary.count({ where }),
      prisma.leave_summary.findMany({
        where,
        orderBy: {
          lea_sapplieddate: "desc",
        },
        skip,
        take,
      }),
    ]);

    return NextResponse.json(paginate(leaves, total, page, limit));
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
