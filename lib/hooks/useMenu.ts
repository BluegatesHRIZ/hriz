"use client"

import { useQuery } from "@tanstack/react-query"
import { apiFetch, ApiError } from "@/lib/api/client"

export interface MenuNameDTO {
  mnu_id: string
  mnu_desc: string | null
  mnu_status: number
  mnu_http: string | null
  mnu_ctr: number | null
}

/**
 * Hook for fetching menu list
 */
export function useMenuList() {
  return useQuery<MenuNameDTO[], ApiError>({
    queryKey: ["menu", "list"],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token")
      if (!token) {
        throw new ApiError("No token found", 401)
      }

      return apiFetch<MenuNameDTO[]>("/menu/list", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    enabled: typeof window !== "undefined" && !!localStorage.getItem("auth_token"),
  })
}
