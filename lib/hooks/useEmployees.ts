"use client"

import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query"
import { apiFetch, ApiError } from "@/lib/api/client"
import type { Paginated } from "@/lib/pagination"
import { DEFAULT_LIMIT } from "@/lib/pagination"

export interface Employee {
  emp_id: string
  emp_first: string | null
  emp_last: string | null
  emp_mid: string | null
  emp_dept: string | null
  emp_pos: string | null
  emp_loc: string | null
  emp_dept_desc: string | null
  emp_pos_desc: string | null
  emp_loc_desc: string | null
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
 * Hook for fetching a page of the employee list (server-side paginated).
 */
export function useEmployees(page = 1, limit = DEFAULT_LIMIT) {
  return useQuery<Paginated<Employee>, ApiError>({
    queryKey: ["employees", "list", page, limit],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token")
      if (!token) throw new ApiError("No token found", 401)

      return apiFetch<Paginated<Employee>>(
        `/employee/list/all?page=${page}&limit=${limit}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )
    },
    placeholderData: keepPreviousData,
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

