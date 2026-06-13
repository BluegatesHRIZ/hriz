import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt-edge";
import { prisma } from "@/lib/db/prisma";

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

    const employee = await prisma.employee.findUnique({ where: { emp_id: empId } });
    if (!employee) return NextResponse.json({ message: "Employee not found" }, { status: 404 });

    const devices = await prisma.terminal.findMany({ where: { ter_type: 1, ter_status: 1 } });

    const results: { device: string; status: string }[] = [];
    for (const dev of devices) {
      const ip = dev.ter_ip ?? "";
      const pass = dev.ter_biopass ?? "";
      try {
        const res = await fetch(`http://${ip}:8090/person/create`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ personId: empId, name: `${employee.emp_last ?? ""} ${employee.emp_first ?? ""}`.trim(), password: pass }),
          signal: AbortSignal.timeout(5_000),
        });
        results.push({ device: dev.ter_code, status: res.ok ? "ok" : `error:${res.status}` });
      } catch (err) {
        results.push({ device: dev.ter_code, status: `unreachable:${String(err)}` });
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error("UFace enroll error:", error);
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
    const { id: empId } = await params;

    const devices = await prisma.terminal.findMany({ where: { ter_type: 1, ter_status: 1 } });

    const results: { device: string; status: string }[] = [];
    for (const dev of devices) {
      const ip = dev.ter_ip ?? "";
      const pass = dev.ter_biopass ?? "";
      try {
        const res = await fetch(`http://${ip}:8090/person/delete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ personId: empId, password: pass }),
          signal: AbortSignal.timeout(5_000),
        });
        results.push({ device: dev.ter_code, status: res.ok ? "ok" : `error:${res.status}` });
      } catch (err) {
        results.push({ device: dev.ter_code, status: `unreachable:${String(err)}` });
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error("UFace delete error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
