"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, apiFetch } from "@/lib/api/client";

function authHeader(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
  if (!token) throw new ApiError("No token found", 401);
  return { Authorization: `Bearer ${token}` };
}

export interface HolidayDTO {
  hol_id: string;
  hol_date: string | null;
  hol_name: string | null;
  hol_type: string | null;
  hol_location: string | null;
  hol_repeat: string | null;
  hol_status: number | null;
  hol_logdate: string | null;
}

export interface HolidayTypeDTO {
  htp_id: string;
  htp_desc: string | null;
}

export interface HolidayFormData {
  hol_date: string;
  hol_name: string;
  hol_type: string;
  hol_location?: string;
  hol_repeat?: string;
  hol_status?: number;
}

const QK = ["admin", "holidays"] as const;

export function useAdminHolidays() {
  return useQuery<HolidayDTO[], ApiError>({
    queryKey: [...QK],
    queryFn: () =>
      apiFetch<HolidayDTO[]>("/admin/holidays", { headers: authHeader() }),
  });
}

export function useHolidayTypes() {
  return useQuery<HolidayTypeDTO[], ApiError>({
    queryKey: ["admin", "holiday-types"],
    queryFn: () =>
      apiFetch<HolidayTypeDTO[]>("/admin/holidays/types", { headers: authHeader() }),
    staleTime: 30 * 60 * 1000,
  });
}

export function useCreateHoliday() {
  const qc = useQueryClient();
  return useMutation<HolidayDTO, ApiError, HolidayFormData>({
    mutationFn: (data) =>
      apiFetch<HolidayDTO>("/admin/holidays", {
        method: "POST",
        headers: { ...authHeader(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...QK] }),
  });
}

export function useUpdateHoliday() {
  const qc = useQueryClient();
  return useMutation<HolidayDTO, ApiError, { id: string } & HolidayFormData>({
    mutationFn: ({ id, ...data }) =>
      apiFetch<HolidayDTO>(`/admin/holidays/${id}`, {
        method: "PUT",
        headers: { ...authHeader(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...QK] }),
  });
}

export function useDeleteHoliday() {
  const qc = useQueryClient();
  return useMutation<{ message: string }, ApiError, string>({
    mutationFn: (id) =>
      apiFetch<{ message: string }>(`/admin/holidays/${id}`, {
        method: "DELETE",
        headers: authHeader(),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...QK] }),
  });
}
