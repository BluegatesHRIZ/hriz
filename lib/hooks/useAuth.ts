"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, ApiError } from "@/lib/api/client";
import { LoginDTO } from "@/lib/types/auth";
import { queryKeys } from "./queries";

interface LoginResponse {
  token: string;
  success?: boolean;
}

interface SessionResponse {
  valid: boolean;
}

/**
 * Hook for user login
 */
export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation<LoginResponse, ApiError, LoginDTO>({
    mutationFn: async (credentials) => {
      return apiFetch<LoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify(credentials),
      });
    },
    onSuccess: (data) => {
      // Store token in localStorage (for client-side access)
      if (typeof window !== "undefined") {
        localStorage.setItem("auth_token", data.token);
        // Also set in cookie (already set by server, but ensure it's there)
        // The server already sets the cookie, so we just need to dispatch the event
        // Dispatch custom event to notify auth context
        window.dispatchEvent(new Event("auth-storage-change"));
      }
      // Invalidate session query to refetch user data
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.session() });
    },
  });
}

/**
 * Hook for validating user session
 */
export function useValidateSession() {
  return useQuery<SessionResponse, ApiError>({
    queryKey: queryKeys.auth.session(),
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      if (!token) {
        throw new ApiError("No token found", 401);
      }

      return apiFetch<SessionResponse>("/auth/validate-session", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook for refreshing token
 */
export function useRefreshToken() {
  const queryClient = useQueryClient();

  return useMutation<LoginResponse, ApiError>({
    mutationFn: async () => {
      const token = localStorage.getItem("auth_token");
      if (!token) {
        throw new ApiError("No token found", 401);
      }

      return apiFetch<LoginResponse>("/auth/refresh", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    },
    onSuccess: (data) => {
      // Update token in localStorage
      localStorage.setItem("auth_token", data.token);
      // Invalidate session query
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.session() });
    },
  });
}

/**
 * Hook for user logout
 */
export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation<void, ApiError>({
    mutationFn: async () => {
      // Call logout API to clear cookies
      const token = localStorage.getItem("auth_token");
      if (token) {
        try {
          await apiFetch("/auth/logout", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
        } catch (error) {
          // Continue with logout even if API call fails
          console.warn("Logout API call failed:", error);
        }
      }

      // Clear token from localStorage
      if (typeof window !== "undefined") {
        localStorage.removeItem("auth_token");
        // Dispatch event to notify auth context
        window.dispatchEvent(new Event("auth-storage-change"));
      }
      // Clear all queries
      queryClient.clear();
    },
  });
}
