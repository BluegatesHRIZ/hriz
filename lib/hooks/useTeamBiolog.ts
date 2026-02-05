"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch, ApiError } from "@/lib/api/client";
import type { TeamGridRow } from "@/lib/services/attendance.service";

export function useTeamBiolog() {
  return useQuery<TeamGridRow[], ApiError>({
    queryKey: ["teamBiolog"],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new ApiError("No token found", 401);

      return apiFetch<TeamGridRow[]>("/biolog/team", {
        headers: { Authorization: `Bearer ${token}` },
      });
    },
    staleTime: 1 * 60 * 1000, // 1 minute
    enabled:
      typeof window !== "undefined" && !!localStorage.getItem("auth_token"),
  });
}
