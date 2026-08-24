"use client"

import { useQuery } from "@tanstack/react-query"
import { apiFetch, ApiError } from "@/lib/api/client"

export interface UserProfile {
  emp_id: string
  emp_first: string | null
  emp_last: string | null
  emp_mid: string | null
  /** Public Supabase Storage URL for the profile picture, null when unset. */
  avatar_url: string | null
  [key: string]: unknown
}

/**
 * The signed-in user's own profile record.
 *
 * The JWT carries only name fields, so anything stored server-side — the
 * profile picture in particular — has to be fetched. Held for five minutes:
 * it changes only when the user uploads a new photo, and the sidebar mounts
 * on every page.
 */
export function useUserProfile() {
  return useQuery<UserProfile, ApiError>({
    queryKey: ["user-profile"],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token")
      if (!token) throw new ApiError("No token found", 401)

      return apiFetch<UserProfile>("/user-profile", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
}
