import { NextRequest, NextResponse } from "next/server";
import { getDeviceStatus } from "@/lib/services/device.service";
import type { DeviceStatusResponse } from "@/lib/types/devices";

/**
 * GET /api/auth/device/status?keyId=<sha256 hex>
 * Public. Read by the sign-in page before anyone signs in, and polled by the
 * "waiting for approval" screen. keyId is optional; without it the answer says
 * only whether devices must be approved.
 */
export async function GET(request: NextRequest) {
  try {
    const keyId = request.nextUrl.searchParams.get("keyId") ?? "";
    const result = await getDeviceStatus(keyId);
    return NextResponse.json<DeviceStatusResponse>(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Device status error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
