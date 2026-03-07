"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { apiFetch, ApiError } from "@/lib/api/client"

export interface ClockAttendanceParams {
  attendanceType: "I" | "O" | "BI" | "BO" // In, Out, Break In, Break Out
  forYesterday?: boolean
  /** Client's local date (YYYY-MM-DD). Send so server uses user's date, not server's. */
  clientDate?: string
  /** Client's local time (HH:mm:ss). Send so server uses user's time, not server's. */
  clientTime?: string
}

export interface ClockAttendanceResponse {
  success: boolean
  message: string
}

/**
 * Hook for clocking in/out or break in/out
 */
export function useClockAttendance() {
  const queryClient = useQueryClient()

  return useMutation<ClockAttendanceResponse, ApiError, ClockAttendanceParams>({
    mutationFn: async (params) => {
      const token = localStorage.getItem("auth_token")
      if (!token) throw new ApiError("No token found", 401)

      return apiFetch<ClockAttendanceResponse>("/attendance/clock", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(params),
      })
    },
    onSuccess: () => {
      // Invalidate biolog and attendance queries
      queryClient.invalidateQueries({ queryKey: ["biolog"] })
      queryClient.invalidateQueries({ queryKey: ["status"] })
    },
  })
}
