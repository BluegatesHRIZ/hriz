"use client";

import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { ApiError, apiFetch } from "@/lib/api/client";
import { DEFAULT_LIMIT } from "@/lib/pagination";
import type { DeviceDTO, DeviceListFilter, DeviceListResponse } from "@/lib/types/devices";

function authHeader(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
  if (!token) throw new ApiError("No token found", 401);
  return { Authorization: `Bearer ${token}` };
}

export type { DeviceDTO };

export interface DeviceFormData {
  ter_code: string;
  ter_id: string;
  ter_ip: string;
  ter_loc?: string;
  ter_biopass?: string;
  ter_biokey?: string;
  ter_device?: string;
  ter_type?: number;
}

const QK = ["admin", "devices"] as const;

export function useAdminDevices(filter: DeviceListFilter, page = 1, limit = DEFAULT_LIMIT) {
  return useQuery<DeviceListResponse, ApiError>({
    queryKey: [...QK, filter, page, limit],
    queryFn: () =>
      apiFetch<DeviceListResponse>(
        `/admin/devices?status=${filter}&page=${page}&limit=${limit}`,
        { headers: authHeader() }
      ),
    placeholderData: keepPreviousData,
    // New requests show up without a reload while the page is open.
    refetchInterval: 30_000,
  });
}

export function useCreateDevice() {
  const qc = useQueryClient();
  return useMutation<DeviceDTO, ApiError, DeviceFormData>({
    mutationFn: (data) =>
      apiFetch<DeviceDTO>("/admin/devices", {
        method: "POST",
        headers: { ...authHeader(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...QK] }),
  });
}

export function useUpdateDevice() {
  const qc = useQueryClient();
  return useMutation<DeviceDTO, ApiError, { ter_code: string } & Partial<DeviceFormData> & { ter_status?: number }>({
    mutationFn: ({ ter_code, ...data }) =>
      apiFetch<DeviceDTO>(`/admin/devices/${ter_code}`, {
        method: "PUT",
        headers: { ...authHeader(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...QK] }),
  });
}

export function useDeleteDevice() {
  const qc = useQueryClient();
  return useMutation<{ message: string }, ApiError, string>({
    mutationFn: (ter_code) =>
      apiFetch<{ message: string }>(`/admin/devices/${ter_code}`, {
        method: "DELETE",
        headers: authHeader(),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...QK] }),
  });
}
