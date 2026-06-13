"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, apiFetch } from "@/lib/api/client";
import { queryKeys } from "@/lib/hooks/queries";

export interface RoleDTO {
  RolId: string;
  RolName: string | null;
  RolDesc: string | null;
}

export interface RoleAndPermissionDTO {
  ArpPer: string | null;
  ArpPerName: string | null;
  ArpPerDesc: string | null;
  ArpPerValue: number | null;
}

export interface RoleIncludeDTO {
  RolId: string;
  RolName: string | null;
  RolDesc: string | null;
  RolesAndPermissionNav: RoleAndPermissionDTO[];
}

export interface PermissionDTO {
  PerId: string;
  PerName: string | null;
  PerDesc: string | null;
  PerValue: number | null;
}

export interface PermissionValueDTO {
  EmpRole: string;
  PerValue: string;
}

export interface RoleMutationResult {
  RolId: string;
  RolName: string | null;
  RolDesc: string | null;
}

export interface RoleFormPayload {
  RolName: string;
  RolDesc: string;
  RolPermission: Array<{ PerId: string }>;
}

function authHeader(): Record<string, string> {
  const token = typeof window === "undefined" ? null : localStorage.getItem("auth_token");
  if (!token) throw new ApiError("No token found", 401);
  return { Authorization: `Bearer ${token}` };
}

/**
 * GET /api/roles-permissions/roles (non-SUPERADMIN role list).
 */
export function useRolesList() {
  return useQuery<RoleDTO[], ApiError>({
    queryKey: queryKeys.rolesPermissions.roles(),
    queryFn: () =>
      apiFetch<RoleDTO[]>("/roles-permissions/roles", {
        headers: authHeader(),
      }),
  });
}

/**
 * GET /api/roles-permissions/role-and-permission – roles with permission nav.
 */
export function useRolesAndPermissions() {
  return useQuery<RoleIncludeDTO[], ApiError>({
    queryKey: queryKeys.rolesPermissions.roleAndPermission(),
    queryFn: () =>
      apiFetch<RoleIncludeDTO[]>("/roles-permissions/role-and-permission", {
        headers: authHeader(),
      }),
  });
}

/**
 * GET /api/roles-permissions/permissions – permissions excluding AllAccess/None.
 */
export function usePermissionsList() {
  return useQuery<PermissionDTO[], ApiError>({
    queryKey: queryKeys.rolesPermissions.permissions(),
    queryFn: () =>
      apiFetch<PermissionDTO[]>("/roles-permissions/permissions", {
        headers: authHeader(),
      }),
  });
}

/**
 * GET /api/roles-permissions/permission-value?role= – cumulative per_value sum.
 */
export function usePermissionValue(role: string | null | undefined) {
  return useQuery<PermissionValueDTO, ApiError>({
    queryKey: queryKeys.rolesPermissions.permissionValue(role ?? ""),
    queryFn: () =>
      apiFetch<PermissionValueDTO>(
        `/roles-permissions/permission-value?role=${encodeURIComponent(role ?? "")}`,
        { headers: authHeader() }
      ),
    enabled: Boolean(role && role.length > 0),
  });
}

function invalidateRolesCache(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: queryKeys.rolesPermissions.all });
  // Legacy `/api/roles` list is consumed by the employee security tab.
  qc.invalidateQueries({ queryKey: ["roles"] });
}

/**
 * POST /api/roles-permissions/roles – create role + assigned permissions.
 */
export function useCreateRole() {
  const qc = useQueryClient();
  return useMutation<RoleMutationResult, ApiError, RoleFormPayload>({
    mutationFn: (payload) =>
      apiFetch<RoleMutationResult>("/roles-permissions/roles", {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify(payload),
      }),
    onSuccess: () => invalidateRolesCache(qc),
  });
}

/**
 * PUT /api/roles-permissions/roles/[id] – update role + replace permissions.
 */
export function useUpdateRole(rolId: string) {
  const qc = useQueryClient();
  return useMutation<RoleMutationResult, ApiError, RoleFormPayload>({
    mutationFn: (payload) =>
      apiFetch<RoleMutationResult>(
        `/roles-permissions/roles/${encodeURIComponent(rolId)}`,
        {
          method: "PUT",
          headers: authHeader(),
          body: JSON.stringify(payload),
        }
      ),
    onSuccess: () => invalidateRolesCache(qc),
  });
}

/**
 * DELETE /api/roles-permissions/roles/[id] – delete role; blocked if assigned.
 */
export function useDeleteRole() {
  const qc = useQueryClient();
  return useMutation<void, ApiError, string>({
    mutationFn: (rolId) =>
      apiFetch<void>(`/roles-permissions/roles/${encodeURIComponent(rolId)}`, {
        method: "DELETE",
        headers: authHeader(),
      }),
    onSuccess: () => invalidateRolesCache(qc),
  });
}
