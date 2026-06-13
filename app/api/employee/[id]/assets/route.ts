import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt-edge";
import { prisma } from "@/lib/db/prisma";

function genId(): string {
  return new Date().toISOString().replace(/\D/g, "").substring(0, 6);
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
    const empIdInt = parseInt(empId) || 0;
    const assets = await prisma.empasset.findMany({ where: { emp_id: empIdInt }, orderBy: { emp_aslogdate: "desc" } });
    return NextResponse.json(assets);
  } catch (error) {
    console.error("Assets GET error:", error);
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
    const empIdInt = parseInt(empId) || 0;
    const body = await request.json() as { emp_asitem?: string; emp_assn?: string; emp_asissue?: string; emp_asreturn?: string; emp_ascond?: string };
    const created = await prisma.empasset.create({
      data: {
        emp_id: empIdInt,
        emp_asid: genId(),
        emp_asitem: body.emp_asitem ?? null,
        emp_assn: body.emp_assn ?? null,
        emp_asissue: body.emp_asissue ? new Date(body.emp_asissue) : null,
        emp_asreturn: body.emp_asreturn ? new Date(body.emp_asreturn) : null,
        emp_ascond: body.emp_ascond ?? null,
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Assets POST error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

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
    await params;
    const body = await request.json() as { emp_asid: string; emp_asitem?: string; emp_assn?: string; emp_asissue?: string; emp_asreturn?: string; emp_ascond?: string };
    if (!body.emp_asid) return NextResponse.json({ message: "emp_asid required" }, { status: 400 });
    const updated = await prisma.empasset.update({
      where: { emp_asid: body.emp_asid },
      data: {
        emp_asitem: body.emp_asitem ?? null,
        emp_assn: body.emp_assn ?? null,
        emp_asissue: body.emp_asissue ? new Date(body.emp_asissue) : null,
        emp_asreturn: body.emp_asreturn ? new Date(body.emp_asreturn) : null,
        emp_ascond: body.emp_ascond ?? null,
      },
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Assets PUT error:", error);
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
    const asid = searchParams.get("asid");
    if (!asid) return NextResponse.json({ message: "asid required" }, { status: 400 });
    await prisma.empasset.delete({ where: { emp_asid: asid } });
    return NextResponse.json({ message: "Deleted" });
  } catch (error) {
    console.error("Assets DELETE error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
