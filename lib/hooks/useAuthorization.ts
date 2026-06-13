"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch, ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/context";
import {
  PERMISSIONS,
  hasAnyPermission,
  parsePermissionMask,
} from "@/lib/auth/permissions";

type PermissionsMapResponse = {
  routePermissions: Record<string, string>;
  menuPermissions: Record<string, string>;
};

export function useAuthorizationMap() {
  return useQuery<PermissionsMapResponse, ApiError>({
    queryKey: ["auth", "permissions-map"],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new ApiError("No token found", 401);
      return apiFetch<PermissionsMapResponse>("/auth/permissions-map", {
        headers: { Authorization: `Bearer ${token}` },
      });
    },
    staleTime: 5 * 60 * 1000,
    enabled: typeof window !== "undefined" && !!localStorage.getItem("auth_token"),
  });
}

export function useCanAccessRoute(routeKey: string) {
  const { user } = useAuth();
  const { data } = useAuthorizationMap();
  return useMemo(() => {
    if (!user || !data) return false;
    const userMask = parsePermissionMask(user.permissions);
    const required = parsePermissionMask(data.routePermissions[routeKey] ?? "0");
    return hasAnyPermission(userMask, required);
  }, [user, data, routeKey]);
}

export function useCanAccessMenu(menuId: string) {
  const { user } = useAuth();
  const { data } = useAuthorizationMap();
  return useMemo(() => {
    if (!user || !data) return false;
    const userMask = parsePermissionMask(user.permissions);
    const required = parsePermissionMask(data.menuPermissions[menuId] ?? "0");
    return hasAnyPermission(userMask, required);
  }, [user, data, menuId]);
}

/**
 * Bitwise check for whether the current user may assign a role to an employee.
 * Mirrors the C# Blazor gate of
 * `AssignRoles | AdministrationRolesAndPermissions | AllAccess`.
 */
export function useCanAssignRoles() {
  const { user } = useAuth();
  return useMemo(() => {
    if (!user) return false;
    const userMask = parsePermissionMask(user.permissions);
    const required =
      PERMISSIONS.AssignRoles |
      PERMISSIONS.AdministrationRolesAndPermissions |
      PERMISSIONS.AllAccess;
    return hasAnyPermission(userMask, required);
  }, [user]);
}

