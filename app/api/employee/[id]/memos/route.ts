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
    const records = await prisma.empmemo.findMany({ where: { emp_id: empId }, orderBy: { emp_mmlogdate: "desc" } });
    return NextResponse.json(records);
  } catch (error) {
    console.error("Memos GET error:", error);
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
    const body = await request.json() as { emp_mmlev?: string; emp_mmcode?: string; emp_mmtype?: string; emp_mmnote?: string };
    const created = await prisma.empmemo.create({
      data: {
        emp_id: empId,
        emp_mmid: genId(),
        emp_mmlev: body.emp_mmlev ?? null,
        emp_mmcode: body.emp_mmcode ?? null,
        emp_mmtype: body.emp_mmtype ?? null,
        emp_mmnote: body.emp_mmnote ?? null,
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Memos POST error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
