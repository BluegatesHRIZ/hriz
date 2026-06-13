"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/context";
import { useAuthorizationMap } from "@/lib/hooks/useAuthorization";
import { hasAnyPermission, parsePermissionMask } from "@/lib/auth/permissions";

interface ProtectedPageProps {
  routeKey?: string;
  children: React.ReactNode;
}

export function ProtectedPage({ routeKey, children }: ProtectedPageProps) {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { data: map, isLoading: mapLoading } = useAuthorizationMap();

  const userMask = parsePermissionMask(user?.permissions ?? "0");
  const requiredMask = parsePermissionMask(
    routeKey ? (map?.routePermissions?.[routeKey] ?? "0") : "0"
  );
  const allowed = !routeKey || hasAnyPermission(userMask, requiredMask);

  useEffect(() => {
    if (authLoading || mapLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (routeKey && !allowed) {
      router.replace("/unauthorized");
    }
  }, [allowed, authLoading, mapLoading, router, routeKey, user]);

  if (authLoading || mapLoading || !user || (routeKey && !allowed)) {
    return <div className="p-6 text-sm text-gray-500">Checking permissions...</div>;
  }

  return <>{children}</>;
}

