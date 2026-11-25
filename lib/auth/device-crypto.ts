/**
 * Device registration crypto. Web Crypto only, so it runs in the edge
 * middleware, in Cloudflare Workers and in Node.
 */

/** httpOnly cookie that ties a session token to the device it was started on. */
export const DEVICE_SESSION_COOKIE = "hriz_device_session";

/** How long a sign-in challenge stays usable. */
export const DEVICE_CHALLENGE_TTL_MS = 2 * 60 * 1000;

/** What a device signs, so a login signature can't be replayed as a registration and back. */
export type DeviceSignPurpose = "login" | "register";

export function deviceSignMessage(purpose: DeviceSignPurpose, challenge: string): string {
  return `hriz-device-${purpose}:${challenge}`;
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(data: string | Uint8Array<ArrayBuffer>): Promise<string> {
  const input = typeof data === "string" ? new TextEncoder().encode(data) : data;
  return bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256", input)));
}

export function randomToken(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

/** Constant-time string comparison for hashes and MACs. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function challengeSecret(): string {
  const secret = process.env.JWT_SALT;
  if (!secret) throw new Error("JWT_SALT environment variable is not set");
  return secret;
}

async function hmac(message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`device-challenge:${challengeSecret()}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return bytesToBase64Url(new Uint8Array(mac));
}

/**
 * A challenge is `<issued-at ms>.<random>.<mac>`. It needs no storage: the MAC
 * proves the server issued it, the timestamp bounds its life, and each device
 * records the newest timestamp it has used so the same challenge can't sign in twice.
 */
export async function createDeviceChallenge(now = Date.now()): Promise<string> {
  const body = `${now}.${randomToken(16)}`;
  return `${body}.${await hmac(body)}`;
}

/** Returns the time the challenge was issued, or null if it is forged, malformed or expired. */
export async function readDeviceChallenge(challenge: string, now = Date.now()): Promise<Date | null> {
  const parts = challenge.split(".");
  if (parts.length !== 3) return null;
  const [issued, nonce, mac] = parts;
  if (!/^\d{13}$/.test(issued) || !nonce) return null;
  if (!safeEqual(mac, await hmac(`${issued}.${nonce}`))) return null;
  const issuedAt = Number(issued);
  // Allow a little clock skew between edge instances.
  if (issuedAt > now + 5_000 || now - issuedAt > DEVICE_CHALLENGE_TTL_MS) return null;
  return new Date(issuedAt);
}

const ECDSA_IMPORT: EcKeyImportParams = { name: "ECDSA", namedCurve: "P-256" };
const ECDSA_SIGN: EcdsaParams = { name: "ECDSA", hash: "SHA-256" };

/** Imports an SPKI public key sent by a browser. Throws if it isn't a P-256 ECDSA key. */
export async function importDevicePublicKey(spkiBase64Url: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("spki", base64UrlToBytes(spkiBase64Url), ECDSA_IMPORT, true, ["verify"]);
}

export async function verifyDeviceSignature(
  publicKey: CryptoKey,
  purpose: DeviceSignPurpose,
  challenge: string,
  signatureBase64Url: string,
): Promise<boolean> {
  try {
    return await crypto.subtle.verify(
      ECDSA_SIGN,
      publicKey,
      base64UrlToBytes(signatureBase64Url),
      new TextEncoder().encode(deviceSignMessage(purpose, challenge)),
    );
  } catch {
    return false;
  }
}
