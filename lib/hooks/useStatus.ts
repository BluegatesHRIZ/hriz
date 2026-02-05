"use client"

import { useQuery } from "@tanstack/react-query"
import { apiFetch, ApiError } from "@/lib/api/client"

export interface StatusDTO {
  statusMinutes: {
    Overtime?: number
    Undertime?: number
    Late?: number
    Absences?: number
  }
  leaveCredits: Array<{
    el_leave: string | null
    el_credit: number | null
    el_used: number | null
    el_balance: number | null
  }>
}

export function useStatus() {
  return useQuery<StatusDTO, ApiError>({
    queryKey: ["status"],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token")
      if (!token) throw new ApiError("No token found", 401)

      return apiFetch<StatusDTO>("/status", {
        headers: { Authorization: `Bearer ${token}` },
      })
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: typeof window !== "undefined" && !!localStorage.getItem("auth_token"),
  })
}
