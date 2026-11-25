import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { encryptPassword } from "@/lib/auth/password";
import { createToken, generateRefreshToken, verifyToken } from "@/lib/auth/jwt-edge";
import { setSessionCookies } from "@/lib/auth/session-cookies";
import type { DeviceClaims, LoginResponse } from "@/lib/types/auth";
import type { employee } from "../../src/generated/prisma/client";

export type CredentialResult =
  | { ok: true; employee: employee }
  | { ok: false; status: number; message: string };

/** Username + password check, as the password login has always done it. */
export async function authenticatePassword(input: {
  EmpId?: string;
  EmpPswd?: string;
  external_id?: boolean;
}): Promise<CredentialResult> {
  const { EmpId, EmpPswd, external_id } = input;
  if (!EmpId || !EmpPswd) {
    return { ok: false, status: 400, message: "Username and password are required" };
  }

  // Encrypt password using the same method as C#
  const encryptedPass = encryptPassword(EmpPswd);

  // Find employee - check if using external_id or regular emp_id
  const employee = external_id
    ? await prisma.employee.findFirst({ where: { emp_extid: EmpId, emp_status: 1 } })
    : await prisma.employee.findFirst({ where: { emp_id: EmpId, emp_status: 1 } });

  if (!employee) {
    return { ok: false, status: 400, message: "User not found" };
  }
  if (!employee.emp_pswd) {
    return { ok: false, status: 400, message: "User has no password set" };
  }

  const storedPassword = Buffer.from(employee.emp_pswd);
  if (Buffer.compare(encryptedPass, storedPassword) !== 0) {
    return { ok: false, status: 400, message: "Wrong password or username" };
  }

  return { ok: true, employee };
}

/** QR sign-in check: a signed, unexpired QR token for an active employee. */
export async function authenticateQrToken(qrToken: string | undefined): Promise<CredentialResult> {
  if (!qrToken) {
    return { ok: false, status: 400, message: "QR token is required" };
  }

  let empId: string | undefined;
  try {
    empId = (await verifyToken(qrToken)).name;
  } catch {
    return { ok: false, status: 401, message: "Invalid or expired QR token" };
  }
  if (!empId) {
    return { ok: false, status: 400, message: "Invalid QR token format" };
  }

  // Deactivated employees can't use a QR code that is still within its validity.
  const employee = await prisma.employee.findFirst({ where: { emp_id: empId, emp_status: 1 } });
  if (!employee) {
    return { ok: false, status: 401, message: "Employee not found or inactive" };
  }

  return { ok: true, employee };
}

export function clientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

/**
 * Issues the session token and refresh token, records them in `emptoken`, and
 * returns the response with the session cookies set.
 */
export async function startSession(
  request: NextRequest,
  employee: employee,
  permissions: string,
  options: {
    device: { claims: DeviceClaims; cookieValue: string } | null;
    ipAddress?: string;
    longitude?: string | null;
    latitude?: string | null;
  },
): Promise<NextResponse<LoginResponse>> {
  const token = await createToken(
    employee.emp_id,
    employee.emp_role || "",
    employee.emp_first || "",
    employee.emp_last || "",
    permissions,
    60, // 60 minutes default
    options.device?.claims,
  );

  const refreshToken = generateRefreshToken();

  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 80); // 60 min token + 20 min buffer

  const record = {
    tkn_jwt: token,
    tkn_refresh: refreshToken,
    tkn_datecreated: new Date(),
    tkn_dateexpires: expiresAt,
    tkn_ipaddress: options.ipAddress || clientIp(request),
    tkn_longitude: options.longitude || null,
    tkn_latitude: options.latitude || null,
  };

  await prisma.emptoken.upsert({
    where: { tkn_emp: employee.emp_id },
    update: record,
    create: { tkn_emp: employee.emp_id, ...record },
  });

  const response = NextResponse.json<LoginResponse>({ token, success: true });
  setSessionCookies(response, {
    token,
    refreshToken,
    deviceSession: options.device?.cookieValue ?? null,
  });
  return response;
}
