import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createToken } from "@/lib/auth/jwt-edge";
import { QrLoginGenerateRequest, QrLoginGenerateResponse } from "@/lib/types/auth";

/**
 * Generate a QR login token for an employee
 * Protected route - requires authentication
 */
export async function POST(request: NextRequest) {
  try {
    const body: QrLoginGenerateRequest = await request.json();
    const { empId } = body;

    if (!empId) {
      return NextResponse.json(
        { message: "Employee ID is required" },
        { status: 400 },
      );
    }

    // Verify employee exists and is active
    const employee = await prisma.employee.findFirst({
      where: {
        emp_id: empId,
        emp_status: 1,
      },
    });

    if (!employee) {
      return NextResponse.json(
        { message: "Employee not found or inactive" },
        { status: 404 },
      );
    }

    // Generate QR token with very long expiration (10 years = 5,256,000 minutes)
    // This makes it effectively non-expiring for printed QR codes
    const qrToken = await createToken(
      employee.emp_id,
      "", // Role not needed for QR token
      "", // First name not needed
      "", // Last name not needed
      "", // Permissions not needed
      5256000, // 10 years in minutes
    );

    const response: QrLoginGenerateResponse = { qrToken };

    return NextResponse.json(response);
  } catch (error) {
    console.error("QR login generate error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
