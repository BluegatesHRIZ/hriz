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
  /** Public Supabase Storage URL for the profile picture, null when unset. */
  emp_avatar_url?: string | null
}

export interface ManageEmployeeStatusPayload {
  empId: string
  status: number
}

export interface EmployeeListFilters {
  page?: number
  limit?: number
  /** Free text over id / last / first / middle name. */
  search?: string
  /** Exact-match code filters. */
  dept?: string
  loc?: string
  pos?: string
}

function employeeListQuery(f: EmployeeListFilters): string {
  const params = new URLSearchParams()
  params.set("page", String(f.page ?? 1))
  params.set("limit", String(f.limit ?? DEFAULT_LIMIT))
  if (f.search?.trim()) params.set("search", f.search.trim())
  if (f.dept) params.set("dept", f.dept)
  if (f.loc) params.set("loc", f.loc)
  if (f.pos) params.set("pos", f.pos)
  return params.toString()
}

/**
 * Hook for fetching a page of the employee list.
 *
 * Search and the dept/loc/pos filters are applied server-side by
 * `/api/employee/list/all` — filtering the returned page in the browser would
 * only ever search the rows already on screen.
 */
export function useEmployees(filters: EmployeeListFilters = {}) {
  const query = employeeListQuery(filters)

  return useQuery<Paginated<Employee>, ApiError>({
    queryKey: ["employees", "list", query],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token")
      if (!token) throw new ApiError("No token found", 401)

      return apiFetch<Paginated<Employee>>(`/employee/list/all?${query}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
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

