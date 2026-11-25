import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, ApiError } from "@/lib/api/client";
import { queryKeys } from "@/lib/hooks/queries";
import type { Paginated } from "@/lib/pagination";
import type {
  DatedScheduleBulkRequest,
  DatedScheduleGridRequest,
  DatedScheduleSaveResponse,
  EmployeeDatedScheduleRow,
} from "@/lib/types";

export interface ScheduleListFilters {
  page?: number;
  limit?: number;
  search?: string;
  dept?: string;
  loc?: string;
}

export interface ScheduleRange {
  from: string;
  to: string;
}

function authHeaders() {
  const token = localStorage.getItem("auth_token");
  if (!token) throw new ApiError("No token found", 401);
  return { Authorization: `Bearer ${token}` };
}

function filterParams(
  filters: Omit<ScheduleListFilters, "page" | "limit">
): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.dept) params.set("dept", filters.dept);
  if (filters.loc) params.set("loc", filters.loc);
  return params;
}

/**
 * Paginated employees, with their dated schedule entries in `range` when one
 * is given (otherwise `days` is empty).
 */
export function useSchedulesList(
  filters: ScheduleListFilters,
  range?: ScheduleRange
) {
  const params = filterParams(filters);
  params.set("page", String(filters.page ?? 1));
  params.set("limit", String(filters.limit ?? 10));
  if (range) {
    params.set("from", range.from);
    params.set("to", range.to);
  }

  return useQuery<Paginated<EmployeeDatedScheduleRow>, ApiError>({
    queryKey: queryKeys.schedules.list({ ...filters, ...range }),
    queryFn: () =>
      apiFetch<Paginated<EmployeeDatedScheduleRow>>(
        `/schedules?${params.toString()}`,
        { headers: authHeaders() }
      ),
    enabled: !range || (!!range.from && !!range.to && range.from <= range.to),
  });
}

/**
 * Fetch every employee id matching the current filters (no pagination),
 * for the "Select all N matching" action. Not auto-run: call `refetch`.
 */
export function useMatchingEmployeeIds(
  filters: Omit<ScheduleListFilters, "page" | "limit">
) {
  const params = filterParams(filters);
  params.set("idsOnly", "1");

  return useQuery<{ ids: string[] }, ApiError>({
    queryKey: [...queryKeys.schedules.all, "ids", filters],
    queryFn: () =>
      apiFetch<{ ids: string[] }>(`/schedules?${params.toString()}`, {
        headers: authHeaders(),
      }),
    enabled: false,
  });
}

/** Set the same dated schedule for many employees at once. */
export function useBulkApplySchedule() {
  const qc = useQueryClient();
  return useMutation<
    DatedScheduleSaveResponse,
    ApiError,
    DatedScheduleBulkRequest
  >({
    mutationFn: (body) =>
      apiFetch<DatedScheduleSaveResponse>("/schedules/bulk-apply", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.schedules.all });
    },
  });
}

/** Save one employee's dates from the grid view. */
export function useSaveScheduleGrid() {
  const qc = useQueryClient();
  return useMutation<
    DatedScheduleSaveResponse,
    ApiError,
    DatedScheduleGridRequest
  >({
    mutationFn: (body) =>
      apiFetch<DatedScheduleSaveResponse>("/schedules/grid", {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.schedules.all });
    },
  });
}
