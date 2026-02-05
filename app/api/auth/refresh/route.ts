import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt";
import { prisma } from "@/lib/db/prisma";
import { createToken, generateRefreshToken } from "@/lib/auth/jwt";

export async function POST(request: NextRequest) {
  try {
    // Get refresh token from cookie
    const refreshToken = request.cookies.get("auth_refresh_token")?.value;

    if (!refreshToken) {
      return NextResponse.json(
        { message: "No refresh token provided" },
        { status: 401 }
      );
    }

    // Get current token from Authorization header
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { message: "No token provided" },
        { status: 401 }
      );
    }

    const currentToken = authHeader.substring(7);
    let payload;
    try {
      payload = verifyToken(currentToken);
    } catch {
      // Token might be expired, which is okay for refresh
      // We'll verify using the refresh token instead
    }

    let bodyUsername: string | undefined;
    try {
      const body = await request.json();
      bodyUsername = (body as { username?: string })?.username;
    } catch {
      bodyUsername = undefined;
    }
    const username = payload?.name || bodyUsername;

    if (!username) {
      return NextResponse.json(
        { message: "Unable to identify user" },
        { status: 401 }
      );
    }

    // Verify refresh token in database
    const empToken = await prisma.emptoken.findUnique({
      where: {
        tkn_emp: username,
      },
    });

    if (!empToken || empToken.tkn_refresh !== refreshToken) {
      return NextResponse.json(
        { message: "Invalid refresh token" },
        { status: 401 }
      );
    }

    // Check if refresh token is expired
    if (empToken.tkn_dateexpires && empToken.tkn_dateexpires < new Date()) {
      return NextResponse.json(
        { message: "Refresh token expired" },
        { status: 401 }
      );
    }

    // Get employee data
    const employee = await prisma.employee.findUnique({
      where: {
        emp_id: username,
      },
    });

    if (!employee) {
      return NextResponse.json(
        { message: "Employee not found" },
        { status: 404 }
      );
    }

    // Get permissions (TODO: Fetch from Accrolepermission table)
    const permissions = "0";

    // Generate new tokens
    const newToken = createToken(
      employee.emp_id,
      employee.emp_role || "",
      employee.emp_first || "",
      employee.emp_last || "",
      permissions,
      60
    );

    const newRefreshToken = generateRefreshToken();

    // Update token in database
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 80); // 60 min token + 20 min buffer

    await prisma.emptoken.update({
      where: {
        tkn_emp: username,
      },
      data: {
        tkn_jwt: newToken,
        tkn_refresh: newRefreshToken,
        tkn_dateexpires: expiresAt,
      },
    });

    // Set new refresh token in cookie
    const response = NextResponse.json({ token: newToken });

    response.cookies.set("auth_refresh_token", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error) {
    console.error("Refresh token error:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
