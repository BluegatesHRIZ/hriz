import { NextRequest, NextResponse } from "next/server";
import {
  authenticatePassword,
  authenticateQrToken,
  clientIp,
} from "@/lib/services/auth.service";
import { registerDevice } from "@/lib/services/device.service";
import type { DeviceRegisterRequest, DeviceRegisterResponse } from "@/lib/types/devices";

/**
 * POST /api/auth/device/register
 * Public, but the person must prove who they are with the same credentials
 * they sign in with. Creates a pending `terminal` row for this browser's key.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<DeviceRegisterRequest>;
    const credentials = body.credentials;
    if (!credentials || typeof credentials !== "object") {
      return NextResponse.json({ message: "Sign-in details are required." }, { status: 400 });
    }

    const auth =
      "qrToken" in credentials
        ? await authenticateQrToken(credentials.qrToken)
        : await authenticatePassword(credentials);
    if (!auth.ok) {
      return NextResponse.json({ message: auth.message }, { status: auth.status });
    }

    const result = await registerDevice({
      employeeId: auth.employee.emp_id,
      publicKey: body.publicKey,
      challenge: body.challenge,
      signature: body.signature,
      name: body.name,
      userAgent: request.headers.get("user-agent"),
      ipAddress: clientIp(request),
    });
    if (!result.ok) {
      return NextResponse.json({ message: result.message }, { status: result.status });
    }

    return NextResponse.json<DeviceRegisterResponse>(
      { status: result.status, ter_code: result.ter_code },
      { status: 201 },
    );
  } catch (error) {
    console.error("Device register error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
