import { NextRequest, NextResponse } from "next/server";
import { LoginDTO } from "@/lib/types/auth";
import { getRolePermissionMask } from "@/lib/services/authorization.service";
import { authenticatePassword, startSession } from "@/lib/services/auth.service";
import { checkDeviceForSignIn } from "@/lib/services/device.service";

export async function POST(request: NextRequest) {
  try {
    const body: LoginDTO = await request.json();

    const auth = await authenticatePassword(body);
    if (!auth.ok) {
      return NextResponse.json({ message: auth.message }, { status: auth.status });
    }
    const { employee } = auth;

    const permissionMask = await getRolePermissionMask(employee.emp_role);

    // Only after the password is right, so device status is never shown to strangers.
    const device = await checkDeviceForSignIn(permissionMask, body.device);
    if (!device.ok) {
      return NextResponse.json(
        { message: device.message, code: device.code },
        { status: device.status },
      );
    }

    return await startSession(request, employee, permissionMask.toString(), {
      device: device.device,
      ipAddress: body.IpAddress,
      longitude: body.longitude,
      latitude: body.latitude,
    });
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
