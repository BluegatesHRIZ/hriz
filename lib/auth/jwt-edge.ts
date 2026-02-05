import { JWTPayload } from "@/lib/types/auth";

const JWT_SECRET = process.env.JWT_SALT || "";

if (!JWT_SECRET) {
  throw new Error("JWT_SALT environment variable is not set");
}

// Convert string to ArrayBuffer
function str2ab(str: string): ArrayBuffer {
  const buf = new ArrayBuffer(str.length);
  const bufView = new Uint8Array(buf);
  for (let i = 0; i < str.length; i++) {
    bufView[i] = str.charCodeAt(i);
  }
  return buf;
}

// Convert ArrayBuffer to base64url
function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

// Convert base64url to ArrayBuffer
function base64UrlToArrayBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(base64 + padding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Get crypto key from secret
async function getKey(): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(JWT_SECRET);
  return await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign", "verify"]
  );
}

/**
 * Creates a JWT token with employee claims
 * Edge-compatible version using Web Crypto API
 */
export async function createToken(
  empId: string,
  empRole: string,
  empFirst: string,
  empLast: string,
  permissions: string,
  expiresInMinutes: number = 60
): Promise<string> {
  const header = {
    alg: "HS512",
    typ: "JWT",
  };

  const now = Math.floor(Date.now() / 1000);
  const payload: JWTPayload & { exp: number; iat: number } = {
    name: empId,
    role: empRole || "",
    Firstname: empFirst || "",
    Lastname: empLast || "",
    permissions: permissions,
    exp: now + expiresInMinutes * 60,
    iat: now,
  };

  const encoder = new TextEncoder();
  const headerBase64 = arrayBufferToBase64Url(
    str2ab(JSON.stringify(header))
  );
  const payloadBase64 = arrayBufferToBase64Url(
    str2ab(JSON.stringify(payload))
  );

  const data = `${headerBase64}.${payloadBase64}`;
  const key = await getKey();
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(data)
  );

  const signatureBase64 = arrayBufferToBase64Url(signature);
  return `${data}.${signatureBase64}`;
}

/**
 * Verifies and decodes a JWT token
 * Edge-compatible version using Web Crypto API
 */
export async function verifyToken(token: string): Promise<JWTPayload> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      throw new Error("Invalid token format");
    }

    const [headerBase64, payloadBase64, signatureBase64] = parts;
    const data = `${headerBase64}.${payloadBase64}`;

    // Verify signature
    const key = await getKey();
    const encoder = new TextEncoder();
    const signature = base64UrlToArrayBuffer(signatureBase64);
    
    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      signature,
      encoder.encode(data)
    );

    if (!isValid) {
      throw new Error("Invalid signature");
    }

    // Decode payload
    const payloadJson = atob(
      payloadBase64.replace(/-/g, "+").replace(/_/g, "/")
    );
    const payload = JSON.parse(payloadJson) as JWTPayload & { exp?: number };

    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      throw new Error("Token expired");
    }

    return {
      name: payload.name,
      role: payload.role,
      Firstname: payload.Firstname,
      Lastname: payload.Lastname,
      permissions: payload.permissions,
    };
  } catch (error) {
    throw new Error(
      `Invalid or expired token: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Generates a refresh token
 * Edge-compatible version using Web Crypto API
 */
export function generateRefreshToken(): string {
  const array = new Uint8Array(64);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}
