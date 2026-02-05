import jwt from "jsonwebtoken";
import crypto from "crypto";
import { JWTPayload } from "@/lib/types/auth";

const JWT_SECRET = process.env.JWT_SALT || "";

if (!JWT_SECRET) {
  throw new Error("JWT_SALT environment variable is not set");
}

/**
 * Creates a JWT token with employee claims
 * Ported from C# CreateToken method
 */
export function createToken(
  empId: string,
  empRole: string,
  empFirst: string,
  empLast: string,
  permissions: string,
  expiresInMinutes: number = 60,
): string {
  const payload: JWTPayload = {
    name: empId,
    role: empRole || "",
    Firstname: empFirst || "",
    Lastname: empLast || "",
    permissions: permissions,
  };

  return jwt.sign(payload, JWT_SECRET, {
    algorithm: "HS512",
    expiresIn: `${expiresInMinutes}m`,
  });
}

/**
 * Verifies and decodes a JWT token
 */
export function verifyToken(token: string): JWTPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ["HS512"],
    }) as JWTPayload;
    return decoded;
  } catch {
    throw new Error("Invalid or expired token");
  }
}

/**
 * Generates a refresh token
 * Ported from C# GenerateRefreshToken method
 */
export function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString("base64");
}
