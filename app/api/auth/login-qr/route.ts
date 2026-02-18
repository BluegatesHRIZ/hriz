import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { verifyToken, createToken, generateRefreshToken } from "@/lib/auth/jwt-edge";
import { QrLoginRequest } from "@/lib/types/auth";

/**
 * Login using a QR token
 * Public route - no authentication required
 */
export async function POST(request: NextRequest) {
  try {
    const body: QrLoginRequest = await request.json();
    const { qrToken } = body;

    if (!qrToken) {
      return NextResponse.json(
        { message: "QR token is required" },
        { status: 400 },
      );
    }

    // Validate the QR JWT token (signature and expiration)
    let qrPayload;
    try {
      qrPayload = await verifyToken(qrToken);
    } catch (error) {
      return NextResponse.json(
        { message: "Invalid or expired QR token" },
        { status: 401 },
      );
    }

    // Extract employee ID from QR token
    const empId = qrPayload.name;
    if (!empId) {
      return NextResponse.json(
        { message: "Invalid QR token format" },
        { status: 400 },
      );
    }

    // Load employee and verify they are still active
    // This provides revocation capability - if employee is deactivated,
    // their QR code will no longer work even if the JWT is still valid
    const employee = await prisma.employee.findFirst({
      where: {
        emp_id: empId,
        emp_status: 1,
      },
    });

    if (!employee) {
      return NextResponse.json(
        { message: "Employee not found or inactive" },
        { status: 401 },
      );
    }

    // Get permissions (simplified for now - will need to fetch from DB)
    const permissions = "0"; // TODO: Fetch from Accrolepermission table

    // Generate session tokens (same flow as password login)
    const token = await createToken(
      employee.emp_id,
      employee.emp_role || "",
      employee.emp_first || "",
      employee.emp_last || "",
      permissions,
      60, // 60 minutes default
    );

    const refreshToken = generateRefreshToken();

    // Store refresh token in database (emptoken table)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 80); // 60 min token + 20 min buffer

    await prisma.emptoken.upsert({
      where: {
        tkn_emp: employee.emp_id,
      },
      update: {
        tkn_jwt: token,
        tkn_refresh: refreshToken,
        tkn_datecreated: new Date(),
        tkn_dateexpires: expiresAt,
        tkn_ipaddress:
          request.headers.get("x-forwarded-for") || "unknown",
        tkn_longitude: null,
        tkn_latitude: null,
      },
      create: {
        tkn_emp: employee.emp_id,
        tkn_jwt: token,
        tkn_refresh: refreshToken,
        tkn_datecreated: new Date(),
        tkn_dateexpires: expiresAt,
        tkn_ipaddress:
          request.headers.get("x-forwarded-for") || "unknown",
        tkn_longitude: null,
        tkn_latitude: null,
      },
    });

    // Set refresh token and JWT token in httpOnly cookies
    const response = NextResponse.json({ token, success: true });

    response.cookies.set("auth_refresh_token", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    // Also set JWT token in cookie for proxy to read (for page routes)
    response.cookies.set("auth_token", token, {
      httpOnly: false, // Needs to be accessible to client-side code too
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60, // 60 minutes (matches token expiry)
    });

    return response;
  } catch (error) {
    console.error("QR login error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
