"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch, ApiError } from "@/lib/api/client"

export interface Employee {
  emp_id: string
  emp_first: string | null
  emp_last: string | null
  emp_mid: string | null
  emp_dept: string | null
  emp_pos: string | null
  emp_loc: string | null
  emp_role: string | null
  emp_status: number | null
  emp_extid: string | null
  emp_datecreated: Date | null
}

export interface ManageEmployeeStatusPayload {
  empId: string
  status: number
}

/**
 * Hook for fetching employee list
 */
export function useEmployees() {
  return useQuery<Employee[], ApiError>({
    queryKey: ["employees", "list"],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token")
      if (!token) throw new ApiError("No token found", 401)

      return apiFetch<Employee[]>("/employee/list/all", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
    },
  })
}

/**
 * Hook for managing employee status (Active, Resigned, etc.)
 */
export function useManageEmployeeStatus() {
  const queryClient = useQueryClient()

  return useMutation<void, ApiError, ManageEmployeeStatusPayload>({
    mutationFn: async ({ empId, status }) => {
      const token = localStorage.getItem("auth_token")
      if (!token) throw new ApiError("No token found", 401)

      return apiFetch<void>(`/employee/status/${empId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees", "list"] })
    },
  })
}

