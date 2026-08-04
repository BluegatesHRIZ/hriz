import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, ApiError } from "@/lib/api/client";
import { queryKeys } from "@/lib/hooks/queries";
import type { Paginated } from "@/lib/pagination";
import {
  toScheduleForm,
  type ScheduleDayValue,
} from "@/components/schedules/scheduleDays";

/** The API write shape for a set of days (times as HH:mm:00). */
export type ScheduleFormDay = ReturnType<typeof toScheduleForm>[number];

export interface EmployeeScheduleRow {
  emp_id: string;
  emp_name: string;
  emp_dept: string | null;
  emp_dept_desc: string | null;
  emp_loc: string | null;
  emp_loc_desc: string | null;
  days: ScheduleDayValue[];
}

export interface ScheduleListFilters {
  page?: number;
  limit?: number;
  search?: string;
  dept?: string;
  loc?: string;
}

function authHeaders() {
  const token = localStorage.getItem("auth_token");
  if (!token) throw new ApiError("No token found", 401);
  return { Authorization: `Bearer ${token}` };
}

function buildQuery(filters: ScheduleListFilters): string {
  const params = new URLSearchParams();
  params.set("page", String(filters.page ?? 1));
  params.set("limit", String(filters.limit ?? 10));
  if (filters.search) params.set("search", filters.search);
  if (filters.dept) params.set("dept", filters.dept);
  if (filters.loc) params.set("loc", filters.loc);
  return params.toString();
}

/** Paginated employees + their current weekly schedule, with filters. */
export function useSchedulesList(filters: ScheduleListFilters) {
  return useQuery<Paginated<EmployeeScheduleRow>, ApiError>({
    queryKey: queryKeys.schedules.list(filters as Record<string, unknown>),
    queryFn: () =>
      apiFetch<Paginated<EmployeeScheduleRow>>(
        `/schedules?${buildQuery(filters)}`,
        { headers: authHeaders() }
      ),
  });
}

/**
 * Fetch every employee id matching the current filters (no pagination),
 * for the "Select all N matching" action. Not auto-run — call `refetch`.
 */
export function useMatchingEmployeeIds(
  filters: Omit<ScheduleListFilters, "page" | "limit">
) {
  const params = new URLSearchParams({ idsOnly: "1" });
  if (filters.search) params.set("search", filters.search);
  if (filters.dept) params.set("dept", filters.dept);
  if (filters.loc) params.set("loc", filters.loc);

  return useQuery<{ ids: string[] }, ApiError>({
    queryKey: [...queryKeys.schedules.all, "ids", filters],
    queryFn: () =>
      apiFetch<{ ids: string[] }>(`/schedules?${params.toString()}`, {
        headers: authHeaders(),
      }),
    enabled: false,
  });
}

/** Apply one weekly schedule to many employees at once. */
export function useBulkApplySchedule() {
  const qc = useQueryClient();
  return useMutation<
    { message: string; count: number },
    ApiError,
    { empIds: string[]; days: ScheduleFormDay[] }
  >({
    mutationFn: (body) =>
      apiFetch("/schedules/bulk-apply", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.schedules.all });
    },
  });
}

/** Save per-employee edits from the grid view. */
export function useSaveScheduleGrid() {
  const qc = useQueryClient();
  return useMutation<
    { message: string; count: number },
    ApiError,
    {
      employees: Array<{
        empId: string;
        days: ScheduleFormDay[];
      }>;
    }
  >({
    mutationFn: (body) =>
      apiFetch("/schedules/grid", {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.schedules.all });
    },
  });
}
