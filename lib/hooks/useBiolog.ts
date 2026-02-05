"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch, ApiError } from "@/lib/api/client";
import type { BioGrid } from "@/lib/types/attendance";

/** GET /api/biolog returns BioGrid[] */
export function useBiolog() {
  return useQuery<BioGrid[], ApiError>({
    queryKey: ["biolog"],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new ApiError("No token found", 401);

      return apiFetch<BioGrid[]>("/biolog", {
        headers: { Authorization: `Bearer ${token}` },
      });
    },
    staleTime: 1 * 60 * 1000, // 1 minute
    enabled:
      typeof window !== "undefined" && !!localStorage.getItem("auth_token"),
  });
}
