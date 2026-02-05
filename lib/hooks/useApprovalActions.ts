"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { apiFetch, ApiError } from "@/lib/api/client"

export interface ApprovalObject {
  mod_id: string
  emp_id: string
  appvr_id: string
  module: string
  [key: string]: any
}

export interface ApprovalReasonForm {
  Fap_Appvr: string
  Fap_Reason: string
  Fap_Type: string // "A" = Approve, "R" = Resend, "C" = Cancel/Reject, "U" = Update
  Fap_TaskId: string
}

/**
 * Hook for approving requests
 * Status: 1 = Approve
 */
export function useApproveRequests() {
  const queryClient = useQueryClient()

  return useMutation<string[], ApiError, ApprovalObject[]>({
    mutationFn: async (approvals) => {
      const token = localStorage.getItem("auth_token")
      if (!token) throw new ApiError("No token found", 401)

      return apiFetch<string[]>("/approval/1", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(approvals),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approval"] })
      queryClient.invalidateQueries({ queryKey: ["requests", "stats"] })
    },
  })
}

/**
 * Hook for rejecting requests
 * Status: 2 = Reject
 */
export function useRejectRequests() {
  const queryClient = useQueryClient()

  return useMutation<string[], ApiError, ApprovalObject[]>({
    mutationFn: async (approvals) => {
      const token = localStorage.getItem("auth_token")
      if (!token) throw new ApiError("No token found", 401)

      return apiFetch<string[]>("/approval/2", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(approvals),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approval"] })
      queryClient.invalidateQueries({ queryKey: ["requests", "stats"] })
    },
  })
}

/**
 * Hook for resending requests
 * Status: 4 = Resend
 */
export function useResendRequests() {
  const queryClient = useQueryClient()

  return useMutation<string[], ApiError, ApprovalObject[]>({
    mutationFn: async (approvals) => {
      const token = localStorage.getItem("auth_token")
      if (!token) throw new ApiError("No token found", 401)

      return apiFetch<string[]>("/approval/4", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(approvals),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approval"] })
      queryClient.invalidateQueries({ queryKey: ["requests", "stats"] })
    },
  })
}

/**
 * Hook for posting approval reason
 */
export function usePostApprovalReason() {
  const queryClient = useQueryClient()

  return useMutation<ApprovalReasonForm, ApiError, ApprovalReasonForm>({
    mutationFn: async (reasonForm) => {
      const token = localStorage.getItem("auth_token")
      if (!token) throw new ApiError("No token found", 401)

      return apiFetch<ApprovalReasonForm>("/approval/reason", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(reasonForm),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approval"] })
    },
  })
}
