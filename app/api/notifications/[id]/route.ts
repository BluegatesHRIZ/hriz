import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt-edge";
import { prisma } from "@/lib/db/prisma";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    try { await verifyToken(authHeader.substring(7)); } catch {
      return NextResponse.json({ message: "Invalid token" }, { status: 401 });
    }
    const { id } = await params;
    const notId = parseInt(id);
    if (isNaN(notId)) return NextResponse.json({ message: "Invalid id" }, { status: 400 });

    await prisma.notification.update({ where: { not_id: notId }, data: { not_status: 1 } });
    return NextResponse.json({ message: "Marked as read" });
  } catch (error) {
    console.error("Notification PUT error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    try { await verifyToken(authHeader.substring(7)); } catch {
      return NextResponse.json({ message: "Invalid token" }, { status: 401 });
    }
    const { id } = await params;
    const notId = parseInt(id);
    if (isNaN(notId)) return NextResponse.json({ message: "Invalid id" }, { status: 400 });

    await prisma.notification.delete({ where: { not_id: notId } });
    return NextResponse.json({ message: "Deleted" });
  } catch (error) {
    console.error("Notification DELETE error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
