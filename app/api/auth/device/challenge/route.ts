import { NextResponse } from "next/server";
import { issueDeviceChallenge } from "@/lib/services/device.service";
import type { DeviceChallengeResponse } from "@/lib/types/devices";

/**
 * GET /api/auth/device/challenge
 * Public. A short-lived challenge the browser signs with its device key before
 * signing in or registering. Stateless, so it writes nothing.
 */
export async function GET() {
  try {
    const challenge = await issueDeviceChallenge();
    return NextResponse.json<DeviceChallengeResponse>(
      { challenge },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Device challenge error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
