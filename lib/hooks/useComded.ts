"use client"

import { useQuery } from "@tanstack/react-query"
import { apiFetch, ApiError } from "@/lib/api/client"

export interface Comded {
  cd_code: string
  cd_desc: string | null
  cd_type: string | null
  cd_ord: number | null
  cd_tax: number | null
}

/**
 * Hook for fetching compensation/deduction types (benefit types)
 */
export function useComded() {
  return useQuery<Comded[], ApiError>({
    queryKey: ["payroll", "comded"],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token")
      if (!token) throw new ApiError("No token found", 401)

      return apiFetch<Comded[]>("/payroll/comded", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
    },
  })
}
