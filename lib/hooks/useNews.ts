"use client"

import { useQuery } from "@tanstack/react-query"
import { apiFetch, ApiError } from "@/lib/api/client"

export interface AnnouncementDTO {
  an_id: number
  an_startdate: Date | null
  an_enddate: Date | null
  an_headline: string | null
  an_message: string | null
  an_repeat: number | null
  an_status: number | null
  an_type: string | null
  an_by: string | null
  an_modified: Date | null
  an_logdate: Date | null
}

/**
 * Hook for fetching announcements/news
 */
export function useNews() {
  return useQuery<AnnouncementDTO[], ApiError>({
    queryKey: ["news"],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token")
      if (!token) {
        throw new ApiError("No token found", 401)
      }

      return apiFetch<AnnouncementDTO[]>("/announcements", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: typeof window !== "undefined" && !!localStorage.getItem("auth_token"),
  })
}
