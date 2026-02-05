import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt-edge";
import { prisma } from "@/lib/db/prisma";
import { encryptPassword } from "@/lib/auth/password";

/**
 * PUT /api/employee/{id}/security
 * Update employee password
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authorization
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    let decoded;
    try {
      decoded = await verifyToken(authHeader.substring(7));
    } catch {
      return NextResponse.json({ message: "Invalid token" }, { status: 401 });
    }

    // In Next.js 15+, params is a Promise - await it
    const resolvedParams = await params;
    const empId = resolvedParams.id;

    if (!empId || typeof empId !== "string") {
      return NextResponse.json(
        { message: "Employee ID is required" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { oldPassword, newPassword, confirmPassword } = body;

    if (!oldPassword || !newPassword || !confirmPassword) {
      return NextResponse.json(
        { message: "All password fields are required" },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { message: "New password and confirm password do not match" },
        { status: 400 }
      );
    }

    // Get employee to verify old password
    const employee = await prisma.employee.findUnique({
      where: { emp_id: empId },
      select: { emp_pswd: true },
    });

    if (!employee) {
      return NextResponse.json(
        { message: "Employee not found" },
        { status: 404 }
      );
    }

    if (!employee.emp_pswd) {
      return NextResponse.json(
        { message: "No password set for this account" },
        { status: 400 }
      );
    }

    // Verify old password
    const oldPasswordHash = encryptPassword(oldPassword);
    const storedPassword = Buffer.from(employee.emp_pswd);

    if (Buffer.compare(oldPasswordHash, storedPassword) !== 0) {
      return NextResponse.json(
        { message: "Old password is incorrect" },
        { status: 400 }
      );
    }

    // Create new password hash
    const newPasswordHash = encryptPassword(newPassword);

    // Update password (Prisma expects Uint8Array for Bytes fields)
    await prisma.employee.update({
      where: { emp_id: empId },
      data: { emp_pswd: new Uint8Array(newPasswordHash) },
    });

    return NextResponse.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Update password error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
