/**
 * Auth-related types: login, JWT payload, refresh token.
 */

import type { DeviceProof } from "../devices";

export interface LoginDTO {
  EmpId: string;
  EmpPswd: string;
  IpAddress?: string;
  longitude?: string;
  latitude?: string;
  external_id?: boolean;
  /** Sent when this browser holds a device key. */
  device?: DeviceProof;
}

export interface JWTPayload {
  name: string; // EmpId
  role: string; // EmpRole
  Firstname: string;
  Lastname: string;
  permissions: string;
  /** ter_code of the approved device the session was started on. */
  dev?: string;
  /** SHA-256 hex of the device session cookie; the session only works alongside that cookie. */
  dvh?: string;
  iat?: number;
  exp?: number;
}

/** Device claims added to a session token signed in on an approved device. */
export interface DeviceClaims {
  dev: string;
  dvh: string;
}

export interface RefreshToken {
  Token: string;
  DateExpires: Date;
  DateCreated: Date;
}

export interface QrLoginGenerateRequest {
  empId: string;
}

export interface QrLoginGenerateResponse {
  qrToken: string;
}

export interface QrLoginRequest {
  qrToken: string;
  /** Sent when this browser holds a device key. */
  device?: DeviceProof;
}

export interface LoginResponse {
  token: string;
  success?: boolean;
}
