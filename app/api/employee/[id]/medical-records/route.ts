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
    const records = await prisma.empmedrec.findMany({ where: { emp_id: empId } });
    return NextResponse.json(records);
  } catch (error) {
    console.error("Medical records GET error:", error);
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
    const body = await request.json() as { emp_mrfile?: string; emp_mrrem?: string };
    const created = await prisma.empmedrec.create({
      data: {
        emp_id: empId,
        emp_mrid: genId(),
        emp_mrfile: body.emp_mrfile ?? null,
        emp_mrrem: body.emp_mrrem ?? null,
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Medical records POST error:", error);
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
    const mrid = searchParams.get("mrid");
    if (!mrid) return NextResponse.json({ message: "mrid required" }, { status: 400 });
    await prisma.empmedrec.delete({ where: { emp_mrid: mrid } });
    return NextResponse.json({ message: "Deleted" });
  } catch (error) {
    console.error("Medical records DELETE error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
