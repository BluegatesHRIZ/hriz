"use client"

import { useQuery } from "@tanstack/react-query"
import { apiFetch, ApiError } from "@/lib/api/client"

export interface LeaveType {
  lev_id: string
  lev_desc: string | null
  lev_days: number | null
}

/**
 * Hook for fetching leave types
 */
export function useLeaveTypes() {
  return useQuery<LeaveType[], ApiError>({
    queryKey: ["leave", "types"],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token")
      if (!token) throw new ApiError("No token found", 401)

      return apiFetch<LeaveType[]>("/leave/types", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
    },
  })
}
