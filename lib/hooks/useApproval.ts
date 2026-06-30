"use client"

import { useQuery } from "@tanstack/react-query"
import { apiFetch, ApiError } from "@/lib/api/client"
import type { Paginated } from "@/lib/pagination"

export interface ApprovalDTO {
  [key: string]: any
}

export function useApproval() {
  return useQuery<ApprovalDTO[], ApiError>({
    queryKey: ["approval"],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token")
      if (!token) throw new ApiError("No token found", 401)

      // Endpoint is server-side paginated; this widget shows the first page.
      const res = await apiFetch<Paginated<ApprovalDTO>>("/approval", {
        headers: { Authorization: `Bearer ${token}` },
      })
      return res.data
    },
    staleTime: 1 * 60 * 1000, // 1 minute
    enabled: typeof window !== "undefined" && !!localStorage.getItem("auth_token"),
  })
}
