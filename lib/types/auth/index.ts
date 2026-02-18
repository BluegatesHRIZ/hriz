/**
 * Auth-related types: login, JWT payload, refresh token.
 */

export interface LoginDTO {
  EmpId: string;
  EmpPswd: string;
  IpAddress?: string;
  longitude?: string;
  latitude?: string;
  external_id?: boolean;
}

export interface JWTPayload {
  name: string; // EmpId
  role: string; // EmpRole
  Firstname: string;
  Lastname: string;
  permissions: string;
  iat?: number;
  exp?: number;
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
}
