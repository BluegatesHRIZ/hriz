"use client"

import { useQuery } from "@tanstack/react-query"
import { apiFetch, ApiError } from "@/lib/api/client"

export interface RequestStatsDTO {
  totals: Array<{
    TotalPending?: number
    TotalResended?: number
    [key: string]: any
  }>
  moduleStats: Array<{
    Module?: string
    Pending?: number
    Resended?: number
    [key: string]: any
  }>
}

export function useRequests() {
  return useQuery<RequestStatsDTO, ApiError>({
    queryKey: ["requests", "stats"],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token")
      if (!token) throw new ApiError("No token found", 401)

      return apiFetch<RequestStatsDTO>("/requests/stats", {
        headers: { Authorization: `Bearer ${token}` },
      })
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: typeof window !== "undefined" && !!localStorage.getItem("auth_token"),
  })
}
