import { NextRequest, NextResponse } from "next/server";
import { verifyToken, createToken, generateRefreshToken } from "@/lib/auth/jwt-edge";
import { prisma } from "@/lib/db/prisma";
import { DEVICE_SESSION_COOKIE } from "@/lib/auth/device-crypto";
import { setSessionCookies } from "@/lib/auth/session-cookies";
import { getRolePermissionMask } from "@/lib/services/authorization.service";
import { checkDeviceForRefresh } from "@/lib/services/device.service";
import type { JWTPayload, LoginResponse } from "@/lib/types/auth";

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

    // The token is usually expired by now; its signature still proves which
    // device the session was bound to.
    const currentToken = authHeader.substring(7);
    let payload: JWTPayload | undefined;
    try {
      payload = await verifyToken(currentToken, { allowExpired: true });
    } catch {
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

    // Same permissions a fresh sign-in would get.
    const permissionMask = await getRolePermissionMask(employee.emp_role);

    // A device rejected or unauthorized since sign-in ends the session here.
    const device = await checkDeviceForRefresh(
      permissionMask,
      { dev: payload?.dev, dvh: payload?.dvh },
      request.cookies.get(DEVICE_SESSION_COOKIE)?.value
    );
    if (!device.ok) {
      return NextResponse.json(
        { message: device.message, code: device.code },
        { status: 401 }
      );
    }

    // Generate new tokens
    const newToken = await createToken(
      employee.emp_id,
      employee.emp_role || "",
      employee.emp_first || "",
      employee.emp_last || "",
      permissionMask.toString(),
      60,
      device.claims ?? undefined
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

    const response = NextResponse.json<LoginResponse>({ token: newToken });
    // Device session cookie stays as it is: the new token carries the same binding.
    setSessionCookies(response, { token: newToken, refreshToken: newRefreshToken });
    return response;
  } catch (error) {
    console.error("Refresh token error:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
