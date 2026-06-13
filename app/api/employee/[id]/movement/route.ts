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
    const records = await prisma.empmovement.findMany({ where: { emp_id: empId }, orderBy: { emp_mvdate: "desc" } });
    return NextResponse.json(records);
  } catch (error) {
    console.error("Movement GET error:", error);
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
    const body = await request.json() as { emp_mvdate?: string; emp_mvposfrm?: string; emp_mvposto?: string; emp_mvsvisor?: string; emp_mvdept?: string; emp_mvtype?: string; emp_mvempstat?: string; emp_mvloc?: string };
    const created = await prisma.empmovement.create({
      data: {
        emp_id: empId,
        emp_mvid: genId(),
        emp_mvdate: body.emp_mvdate ? new Date(body.emp_mvdate) : null,
        emp_mvposfrm: body.emp_mvposfrm ?? null,
        emp_mvposto: body.emp_mvposto ?? null,
        emp_mvsvisor: body.emp_mvsvisor ?? null,
        emp_mvdept: body.emp_mvdept ?? null,
        emp_mvtype: body.emp_mvtype ?? null,
        emp_mvempstat: body.emp_mvempstat ?? null,
        emp_mvloc: body.emp_mvloc ?? null,
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Movement POST error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
