import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { encryptPassword } from "@/lib/auth/password";
import { createToken, generateRefreshToken } from "@/lib/auth/jwt";
import { LoginDTO } from "@/lib/types/auth";

export async function POST(request: NextRequest) {
  try {
    const body: LoginDTO = await request.json();
    const { EmpId, EmpPswd, external_id } = body;

    if (!EmpId || !EmpPswd) {
      return NextResponse.json(
        { message: "Username and password are required" },
        { status: 400 },
      );
    }

    // Encrypt password using the same method as C#
    const encryptedPass = encryptPassword(EmpPswd);

    // Find employee - check if using external_id or regular emp_id
    const employee = external_id
      ? await prisma.employee.findFirst({
          where: {
            emp_extid: EmpId,
            emp_status: 1,
          },
        })
      : await prisma.employee.findFirst({
          where: {
            emp_id: EmpId,
            emp_status: 1,
          },
        });

    if (!employee) {
      return NextResponse.json({ message: "User not found" }, { status: 400 });
    }

    // Compare encrypted password with stored password
    // Note: The C# code uses a stored procedure "login" which handles this
    // For now, we'll do a direct comparison
    if (!employee.emp_pswd) {
      return NextResponse.json(
        { message: "User has no password set" },
        { status: 400 },
      );
    }

    const storedPassword = Buffer.from(employee.emp_pswd);
    if (Buffer.compare(encryptedPass, storedPassword) !== 0) {
      return NextResponse.json(
        { message: "Wrong password or username" },
        { status: 400 },
      );
    }

    // Get permissions (simplified for now - will need to fetch from DB)
    const permissions = "0"; // TODO: Fetch from Accrolepermission table

    // Generate tokens
    const token = createToken(
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
          body.IpAddress || request.headers.get("x-forwarded-for") || "unknown",
        tkn_longitude: body.longitude || null,
        tkn_latitude: body.latitude || null,
      },
      create: {
        tkn_emp: employee.emp_id,
        tkn_jwt: token,
        tkn_refresh: refreshToken,
        tkn_datecreated: new Date(),
        tkn_dateexpires: expiresAt,
        tkn_ipaddress:
          body.IpAddress || request.headers.get("x-forwarded-for") || "unknown",
        tkn_longitude: body.longitude || null,
        tkn_latitude: body.latitude || null,
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
    console.error("Login error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
