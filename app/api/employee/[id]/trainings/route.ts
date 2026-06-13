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
    const records = await prisma.emptraining.findMany({ where: { emp_id: empId }, orderBy: { emp_trdate: "desc" } });
    return NextResponse.json(records);
  } catch (error) {
    console.error("Trainings GET error:", error);
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
    const body = await request.json() as { emp_trdate?: string; emp_trdesc?: string; emp_tradd?: string; emp_trspeak?: string; emp_trtype?: string };
    const created = await prisma.emptraining.create({
      data: {
        emp_id: empId,
        emp_trid: genId(),
        emp_trdate: body.emp_trdate ? new Date(body.emp_trdate) : null,
        emp_trdesc: body.emp_trdesc ?? null,
        emp_tradd: body.emp_tradd ?? null,
        emp_trspeak: body.emp_trspeak ?? null,
        emp_trtype: body.emp_trtype ?? null,
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Trainings POST error:", error);
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
    const trid = searchParams.get("trid");
    if (!trid) return NextResponse.json({ message: "trid required" }, { status: 400 });
    await prisma.emptraining.delete({ where: { emp_trid: trid } });
    return NextResponse.json({ message: "Deleted" });
  } catch (error) {
    console.error("Trainings DELETE error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
