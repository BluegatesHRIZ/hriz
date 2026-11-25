import { NextRequest, NextResponse } from "next/server";
import { QrLoginRequest } from "@/lib/types/auth";
import { getRolePermissionMask } from "@/lib/services/authorization.service";
import { authenticateQrToken, startSession } from "@/lib/services/auth.service";
import { checkDeviceForSignIn } from "@/lib/services/device.service";

/**
 * Login using a QR token
 * Public route - no authentication required
 */
export async function POST(request: NextRequest) {
  try {
    const body: QrLoginRequest = await request.json();

    const auth = await authenticateQrToken(body.qrToken);
    if (!auth.ok) {
      return NextResponse.json({ message: auth.message }, { status: auth.status });
    }
    const { employee } = auth;

    const permissionMask = await getRolePermissionMask(employee.emp_role);

    const device = await checkDeviceForSignIn(permissionMask, body.device);
    if (!device.ok) {
      return NextResponse.json(
        { message: device.message, code: device.code },
        { status: device.status },
      );
    }

    return await startSession(request, employee, permissionMask.toString(), {
      device: device.device,
    });
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
