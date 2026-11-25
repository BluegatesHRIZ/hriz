import { prisma } from "@/lib/db/prisma";
import { PERMISSIONS, hasAnyPermission } from "@/lib/auth/permissions";
import {
  bytesToBase64Url,
  createDeviceChallenge,
  importDevicePublicKey,
  randomToken,
  readDeviceChallenge,
  safeEqual,
  sha256Hex,
  verifyDeviceSignature,
} from "@/lib/auth/device-crypto";
import { describeUserAgent } from "@/lib/utils/user-agent";
import type { DeviceClaims } from "@/lib/types/auth";
import type {
  DeviceDTO,
  DeviceErrorCode,
  DeviceLimitUsage,
  DeviceLimits,
  DeviceProof,
  DeviceStatus,
  DeviceStatusResponse,
} from "@/lib/types/devices";
import type { terminal } from "../../src/generated/prisma/client";

/** `terminal.ter_status` values. */
export const TERMINAL_STATUS = { pending: 0, approved: 1, rejected: 2 } as const;

/** `terminal.ter_type` for a browser that registered itself. Counts toward "Number of Terminals". */
const BROWSER_TERMINAL_TYPE = 0;

/** Most requests one employee can have waiting at once, so the queue can't be flooded. */
const MAX_PENDING_PER_EMPLOYEE = 3;

/**
 * Development only: a device registered under one of these names is approved
 * at once, so testing sign-in doesn't need an admin each time. Comma-separated
 * in DEV_AUTO_APPROVE_DEVICES; defaults to CAS001. Never applies outside `next dev`.
 */
function isDevAutoApproveName(name: string): boolean {
  if (process.env.NODE_ENV !== "development") return false;
  const names = (process.env.DEV_AUTO_APPROVE_DEVICES ?? "CAS001")
    .split(",")
    .map((n) => n.trim().toUpperCase())
    .filter(Boolean);
  return names.includes(name.trim().toUpperCase());
}

/** Sign-in internals the Register Device page never receives. */
export const TERMINAL_PRIVATE_COLUMNS = {
  ter_pubkey: true,
  ter_keyid: true,
  ter_chalts: true,
} as const;

export type DeviceFailure = { ok: false; status: number; code: DeviceErrorCode; message: string };

const NOT_REGISTERED: DeviceFailure = {
  ok: false,
  status: 403,
  code: "DEVICE_NOT_REGISTERED",
  message: "This device is not registered. Register it to sign in here.",
};
const PENDING: DeviceFailure = {
  ok: false,
  status: 403,
  code: "DEVICE_PENDING",
  message: "This device is waiting for approval.",
};
const REJECTED: DeviceFailure = {
  ok: false,
  status: 403,
  code: "DEVICE_REJECTED",
  message: "This device was not approved. Ask HR if you need to sign in here.",
};
const PROOF_INVALID: DeviceFailure = {
  ok: false,
  status: 401,
  code: "DEVICE_PROOF_INVALID",
  message: "This device could not be verified. Try signing in again.",
};

/**
 * How many authorized terminals of each type Settings allows, and how many are
 * authorized now. ter_type 0 (browsers and standard terminals) counts toward
 * "Number of Terminals"; ter_type 1 (biometric) toward "Number of Devices".
 * A negative limit means no limit (live data has set_terminal = -1 alongside
 * 20 authorized terminals); `limit` is then null.
 */
export async function getTerminalLimits(): Promise<DeviceLimits> {
  const [settings, standard, biometric] = await Promise.all([
    prisma.settings_tab.findFirst({ select: { set_terminal: true, set_device: true } }),
    prisma.terminal.count({ where: { ter_type: 0, ter_status: TERMINAL_STATUS.approved } }),
    prisma.terminal.count({ where: { ter_type: 1, ter_status: TERMINAL_STATUS.approved } }),
  ]);
  const usage = (setting: number | null | undefined, authorized: number): DeviceLimitUsage => {
    // No settings row: nothing to enforce.
    if (!settings) return { limit: null, authorized, full: false };
    const limit = setting ?? 0;
    if (limit < 0) return { limit: null, authorized, full: false };
    return { limit, authorized, full: authorized >= limit };
  };
  return {
    terminal: usage(settings?.set_terminal, standard),
    device: usage(settings?.set_device, biometric),
  };
}

/** Whether authorizing one more terminal of this type would go over the limit in Settings. */
export async function isTerminalLimitReached(terType: number | null | undefined): Promise<boolean> {
  if (terType !== 0 && terType !== 1) return false;
  const limits = await getTerminalLimits();
  return (terType === 0 ? limits.terminal : limits.device).full;
}

export async function isDeviceRegistrationRequired(): Promise<boolean> {
  const settings = await prisma.settings_tab.findFirst({ select: { set_devreg: true } });
  return Number(settings?.set_devreg ?? 0) === 1;
}

/**
 * People who approve devices sign in anywhere, so turning the setting on can
 * never lock out the admin who has to approve everyone else.
 */
export function isExemptFromDeviceCheck(permissionMask: bigint): boolean {
  return hasAnyPermission(permissionMask, PERMISSIONS.RegisterDevice | PERMISSIONS.AllAccess);
}

export async function issueDeviceChallenge(): Promise<string> {
  return createDeviceChallenge();
}

function statusOf(row: Pick<terminal, "ter_status">): DeviceStatus {
  if (row.ter_status === TERMINAL_STATUS.approved) return "approved";
  if (row.ter_status === TERMINAL_STATUS.rejected) return "rejected";
  return "pending";
}

function isProofShaped(proof: unknown): proof is DeviceProof {
  const p = proof as Partial<DeviceProof> | null | undefined;
  return (
    typeof p?.keyId === "string" &&
    /^[0-9a-f]{64}$/.test(p.keyId) &&
    typeof p.challenge === "string" &&
    typeof p.signature === "string"
  );
}

export type DeviceSignInResult =
  | { ok: true; device: { claims: DeviceClaims; cookieValue: string } | null }
  | DeviceFailure;

/**
 * Decides whether a sign-in may go ahead on this device. Call it after the
 * credentials are confirmed, so device status is only revealed to real users.
 * Returns the device session to bind to the new token, or null when the check
 * doesn't apply (setting off, or the person approves devices).
 */
export async function checkDeviceForSignIn(
  permissionMask: bigint,
  proof: unknown,
): Promise<DeviceSignInResult> {
  if (!(await isDeviceRegistrationRequired())) return { ok: true, device: null };
  if (isExemptFromDeviceCheck(permissionMask)) return { ok: true, device: null };
  if (!isProofShaped(proof)) return NOT_REGISTERED;

  const row = await prisma.terminal.findUnique({ where: { ter_keyid: proof.keyId } });
  if (!row?.ter_pubkey) return NOT_REGISTERED;

  const issuedAt = await readDeviceChallenge(proof.challenge);
  if (!issuedAt) return PROOF_INVALID;

  let publicKey: CryptoKey;
  try {
    publicKey = await importDevicePublicKey(row.ter_pubkey);
  } catch {
    return PROOF_INVALID;
  }
  if (!(await verifyDeviceSignature(publicKey, "login", proof.challenge, proof.signature))) {
    return PROOF_INVALID;
  }

  const status = statusOf(row);
  if (status === "rejected") return REJECTED;
  if (status === "pending") return PENDING;

  // Each challenge works once per device: only a newer challenge than the last one used is accepted.
  const claimed = await prisma.terminal.updateMany({
    where: {
      ter_code: row.ter_code,
      ter_status: TERMINAL_STATUS.approved,
      OR: [{ ter_chalts: null }, { ter_chalts: { lt: issuedAt } }],
    },
    data: { ter_chalts: issuedAt, ter_lastseen: new Date() },
  });
  if (claimed.count !== 1) return PROOF_INVALID;

  const cookieValue = randomToken(32);
  return {
    ok: true,
    device: { claims: { dev: row.ter_code, dvh: await sha256Hex(cookieValue) }, cookieValue },
  };
}

/**
 * Refresh keeps a device-bound session only while the device is still approved
 * and the browser still has the cookie the session was bound to.
 */
export async function checkDeviceForRefresh(
  permissionMask: bigint,
  claims: { dev?: string; dvh?: string },
  deviceCookie: string | undefined,
): Promise<{ ok: true; claims: DeviceClaims | null } | DeviceFailure> {
  if (!(await isDeviceRegistrationRequired())) return { ok: true, claims: null };
  if (isExemptFromDeviceCheck(permissionMask)) return { ok: true, claims: null };

  // A session started before the setting was turned on has to sign in again through the check.
  if (!claims.dev || !claims.dvh || !deviceCookie) return NOT_REGISTERED;
  if (!safeEqual(await sha256Hex(deviceCookie), claims.dvh)) return PROOF_INVALID;

  const row = await prisma.terminal.findUnique({
    where: { ter_code: claims.dev },
    select: { ter_status: true },
  });
  if (!row) return NOT_REGISTERED;
  const status = statusOf(row);
  if (status === "rejected") return REJECTED;
  if (status === "pending") return PENDING;

  return { ok: true, claims: { dev: claims.dev, dvh: claims.dvh } };
}

function newTerminalCode(): string {
  // "W" for web, then 10 characters: fits ter_code VARCHAR(11).
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  return "W" + Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export type DeviceRegisterResult =
  | { ok: true; status: DeviceStatus; ter_code: string }
  | { ok: false; status: number; message: string };

/**
 * Records a browser's request to be approved. The caller has already confirmed
 * the person's credentials; this checks that the browser really holds the
 * private key for the public key it sent.
 */
export async function registerDevice(input: {
  employeeId: string;
  publicKey: unknown;
  challenge: unknown;
  signature: unknown;
  name: unknown;
  userAgent: string | null;
  ipAddress: string;
}): Promise<DeviceRegisterResult> {
  if (!(await isDeviceRegistrationRequired())) {
    return { ok: false, status: 400, message: "Device registration is turned off." };
  }

  const { publicKey, challenge, signature } = input;
  if (typeof publicKey !== "string" || typeof challenge !== "string" || typeof signature !== "string") {
    return { ok: false, status: 400, message: "Device key, challenge and signature are required." };
  }

  let key: CryptoKey;
  try {
    key = await importDevicePublicKey(publicKey);
  } catch {
    return { ok: false, status: 400, message: "The device key is not valid." };
  }
  if (!(await readDeviceChallenge(challenge))) {
    return { ok: false, status: 400, message: "The request took too long. Try again." };
  }
  if (!(await verifyDeviceSignature(key, "register", challenge, signature))) {
    return { ok: false, status: 400, message: "This device could not be verified. Try again." };
  }

  // Store the key in canonical form so the same key always hashes to the same id.
  const spki = new Uint8Array(await crypto.subtle.exportKey("spki", key));
  const keyId = await sha256Hex(spki);
  const existing = await prisma.terminal.findUnique({ where: { ter_keyid: keyId } });
  if (existing) return { ok: true, status: statusOf(existing), ter_code: existing.ter_code };

  const name =
    typeof input.name === "string" && input.name.trim()
      ? input.name.trim().slice(0, 100)
      : describeUserAgent(input.userAgent);
  // The limit still applies: when it is reached the device waits like any other.
  const autoApprove =
    isDevAutoApproveName(name) && !(await isTerminalLimitReached(BROWSER_TERMINAL_TYPE));

  const waiting = autoApprove ? 0 : await prisma.terminal.count({
    where: { ter_reqemp: input.employeeId, ter_status: TERMINAL_STATUS.pending },
  });
  if (waiting >= MAX_PENDING_PER_EMPLOYEE) {
    return {
      ok: false,
      status: 429,
      message: "You already have devices waiting for approval. Ask HR to review them first.",
    };
  }

  if (autoApprove) {
    console.warn(`[dev] Auto-approving device "${name}" for ${input.employeeId} (DEV_AUTO_APPROVE_DEVICES)`);
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const created = await prisma.terminal.create({
        data: {
          ter_code: newTerminalCode(),
          ter_id: name,
          ter_ip: input.ipAddress.slice(0, 45),
          ter_type: BROWSER_TERMINAL_TYPE,
          ter_status: autoApprove ? TERMINAL_STATUS.approved : TERMINAL_STATUS.pending,
          ter_biokey: "",
          ter_pubkey: bytesToBase64Url(spki),
          ter_keyid: keyId,
          ter_reqemp: input.employeeId,
          ter_agent: input.userAgent?.slice(0, 255) ?? null,
        },
      });
      return { ok: true, status: statusOf(created), ter_code: created.ter_code };
    } catch (error: unknown) {
      if ((error as { code?: string }).code !== "P2002") throw error;
      // Same key registered concurrently: report that row.
      const raced = await prisma.terminal.findUnique({ where: { ter_keyid: keyId } });
      if (raced) return { ok: true, status: statusOf(raced), ter_code: raced.ter_code };
      // Otherwise the random code collided; try another.
    }
  }
  throw new Error("Could not allocate a device code");
}

/**
 * What the sign-in page needs before anyone signs in: whether devices must be
 * approved, and where this browser's key stands. Reveals nothing else.
 */
export async function getDeviceStatus(keyId: string): Promise<DeviceStatusResponse> {
  const required = await isDeviceRegistrationRequired();
  if (!/^[0-9a-f]{64}$/.test(keyId)) return { required, status: "unknown", ter_code: null };
  const row = await prisma.terminal.findUnique({
    where: { ter_keyid: keyId },
    select: { ter_status: true, ter_code: true },
  });
  if (!row) return { required, status: "unknown", ter_code: null };
  return { required, status: statusOf(row), ter_code: row.ter_code };
}

type PublicTerminal = Omit<terminal, keyof typeof TERMINAL_PRIVATE_COLUMNS>;

/** Shapes a terminal row for the Register Device page. */
export function toDeviceDTO(
  row: PublicTerminal,
  lookups: { locations: Map<string, string | null>; employees: Map<string, string> },
): DeviceDTO {
  return {
    ter_code: row.ter_code,
    ter_id: row.ter_id,
    ter_loc: row.ter_loc,
    ter_loc_desc: row.ter_loc ? lookups.locations.get(row.ter_loc) ?? null : null,
    ter_ip: row.ter_ip,
    ter_status: row.ter_status,
    ter_biopass: row.ter_biopass,
    ter_type: row.ter_type,
    ter_device: row.ter_device,
    ter_biokey: row.ter_biokey,
    ter_logdate: row.ter_logdate.toISOString(),
    ter_clocking: row.ter_clocking,
    ter_reqemp: row.ter_reqemp,
    ter_reqemp_name: row.ter_reqemp ? lookups.employees.get(row.ter_reqemp) ?? null : null,
    ter_agent: row.ter_agent,
    ter_lastseen: row.ter_lastseen ? row.ter_lastseen.toISOString() : null,
  };
}

/** Name lookups for a page of terminal rows. */
export async function deviceLookups(rows: Array<Pick<terminal, "ter_loc" | "ter_reqemp">>) {
  const empIds = [...new Set(rows.map((r) => r.ter_reqemp).filter((id): id is string => !!id))];
  const [locations, employees] = await Promise.all([
    prisma.location.findMany({ select: { loc_id: true, loc_desc: true } }),
    empIds.length
      ? prisma.employee.findMany({
          where: { emp_id: { in: empIds } },
          select: { emp_id: true, emp_first: true, emp_last: true },
        })
      : Promise.resolve([]),
  ]);
  return {
    locations: new Map(locations.map((l) => [l.loc_id, l.loc_desc])),
    employees: new Map<string, string>(
      employees.map((e): [string, string] => [
        e.emp_id,
        [e.emp_first, e.emp_last].filter(Boolean).join(" ") || e.emp_id,
      ]),
    ),
  };
}
