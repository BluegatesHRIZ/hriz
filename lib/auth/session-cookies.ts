import type { NextResponse } from "next/server";
import { DEVICE_SESSION_COOKIE } from "@/lib/auth/device-crypto";

const secure = process.env.NODE_ENV === "production";

/**
 * Sets the session cookies on a sign-in or refresh response.
 * `deviceSession`: a new device session value to set, `null` to clear it,
 * `undefined` to leave whatever the browser has.
 */
export function setSessionCookies(
  response: NextResponse,
  values: { token: string; refreshToken: string; deviceSession?: string | null },
): void {
  response.cookies.set("auth_refresh_token", values.refreshToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  // JWT in a cookie too, so the middleware can read it on page routes.
  response.cookies.set("auth_token", values.token, {
    httpOnly: false, // Needs to be accessible to client-side code too
    secure,
    sameSite: "lax",
    maxAge: 60 * 60, // 60 minutes (matches token expiry)
  });

  if (values.deviceSession) {
    // Scripts can't read it, so a session token copied off this browser is useless elsewhere.
    response.cookies.set(DEVICE_SESSION_COOKIE, values.deviceSession, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // as long as the refresh token
    });
  } else if (values.deviceSession === null) {
    response.cookies.delete(DEVICE_SESSION_COOKIE);
  }
}

export function clearSessionCookies(response: NextResponse): void {
  response.cookies.delete("auth_token");
  response.cookies.delete("auth_refresh_token");
  response.cookies.delete(DEVICE_SESSION_COOKIE);
}
