import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt-edge";
import { prisma } from "@/lib/db/prisma";

function genId(): string {
  return new Date().toISOString().replace(/\D/g, "").substring(0, 14);
}

export async function GET(
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
    const { id: empId } = await params;
    const records = await prisma.approvallevels.findMany({ where: { al_emp: empId }, orderBy: { al_level: "asc" } });
    return NextResponse.json(records);
  } catch (error) {
    console.error("Approval levels GET error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
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
    const { id: empId } = await params;
    const body = await request.json() as { al_appvr?: string; al_menu?: string; al_level?: number };
    const created = await prisma.approvallevels.create({
      data: {
        al_id: genId(),
        al_emp: empId,
        al_appvr: body.al_appvr ?? null,
        al_menu: body.al_menu ?? null,
        al_level: body.al_level ?? 1,
        al_stat: 1,
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Approval levels POST error:", error);
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
    await params;
    const { searchParams } = new URL(request.url);
    const alId = searchParams.get("al_id");
    if (!alId) return NextResponse.json({ message: "al_id required" }, { status: 400 });
    await prisma.approvallevels.delete({ where: { al_id: alId } });
    return NextResponse.json({ message: "Deleted" });
  } catch (error) {
    console.error("Approval levels DELETE error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
