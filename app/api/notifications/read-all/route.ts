import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt-edge";
import { prisma } from "@/lib/db/prisma";

export async function PUT(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    let payload: { name?: string };
    try {
      payload = await verifyToken(authHeader.substring(7)) as { name?: string };
    } catch {
      return NextResponse.json({ message: "Invalid token" }, { status: 401 });
    }

    const empId = payload.name ?? "";
    await prisma.notification.updateMany({
      where: { not_emp: empId, not_status: 0 },
      data: { not_status: 1 },
    });

    return NextResponse.json({ message: "All marked as read" });
  } catch (error) {
    console.error("Notifications read-all error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
