/**
 * Device registration: browsers that must be approved before anyone signs in on them.
 */

/** Why a sign-in was refused because of the device. Sent as `code` on 401/403 responses. */
export type DeviceErrorCode =
  | "DEVICE_NOT_REGISTERED"
  | "DEVICE_PENDING"
  | "DEVICE_REJECTED"
  | "DEVICE_PROOF_INVALID";

export interface DeviceErrorResponse {
  message: string;
  code: DeviceErrorCode;
}

/** Proof that the request comes from the browser holding a registered key. */
export interface DeviceProof {
  /** SHA-256 hex of the device's public key. */
  keyId: string;
  /** Challenge from GET /api/auth/device/challenge. */
  challenge: string;
  /** ECDSA P-256 signature over the challenge, base64url. */
  signature: string;
}

export interface DeviceChallengeResponse {
  challenge: string;
}

/** The person asking to register a device proves who they are the same way they sign in. */
export type DeviceRegisterCredentials =
  | { EmpId: string; EmpPswd: string; external_id?: boolean }
  | { qrToken: string };

export interface DeviceRegisterRequest {
  credentials: DeviceRegisterCredentials;
  /** SPKI public key, base64url. */
  publicKey: string;
  challenge: string;
  /** Signature over the challenge with the matching private key, base64url. */
  signature: string;
  /** Name the person gave the device, e.g. "Front desk PC". */
  name?: string;
}

export type DeviceStatus = "pending" | "approved" | "rejected" | "unknown";

export interface DeviceRegisterResponse {
  status: DeviceStatus;
  ter_code: string;
}

export interface DeviceStatusResponse {
  /** Whether sign-in currently requires an approved device. */
  required: boolean;
  /** "unknown" when the browser sent no key id or the key isn't registered. */
  status: DeviceStatus;
  ter_code: string | null;
}

/** Which devices the Register Device page lists. Rejected devices are never listed. */
export type DeviceListFilter = "pending" | "authorized" | "all";

export interface DeviceListCounts {
  pending: number;
  authorized: number;
  all: number;
}

/** One limit from Settings and how much of it is used. */
export interface DeviceLimitUsage {
  /** Most authorized at once; null when there is no limit (a negative setting). */
  limit: number | null;
  /** How many are authorized now. */
  authorized: number;
  /** True when no more can be authorized. */
  full: boolean;
}

export interface DeviceLimits {
  /** "Number of Terminals": ter_type 0, which includes browsers registered from the sign-in page. */
  terminal: DeviceLimitUsage;
  /** "Number of Devices": ter_type 1, biometric devices. */
  device: DeviceLimitUsage;
}

/** GET /api/admin/devices: one page of devices plus the count behind each tab. */
export interface DeviceListResponse {
  data: DeviceDTO[];
  meta: { total: number; page: number; limit: number; pageCount: number; hasMore: boolean };
  counts: DeviceListCounts;
  limits: DeviceLimits;
}

/** A `terminal` row as the Register Device page sees it. */
export interface DeviceDTO {
  ter_code: string;
  ter_id: string | null;
  ter_loc: string | null;
  ter_loc_desc: string | null;
  ter_ip: string | null;
  ter_status: number | null;
  ter_biopass: string | null;
  ter_type: number | null;
  ter_device: string | null;
  ter_biokey: string | null;
  ter_logdate: string;
  ter_clocking: number | null;
  ter_reqemp: string | null;
  ter_reqemp_name: string | null;
  ter_agent: string | null;
  ter_lastseen: string | null;
}
