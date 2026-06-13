"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, apiFetch } from "@/lib/api/client";
import { SettingsDTO, CompanyDTO } from "@/lib/hooks/useSettings";

function authHeader(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
  if (!token) throw new ApiError("No token found", 401);
  return { Authorization: `Bearer ${token}` };
}

export interface PeriodTypeDTO {
  pyt_id: number;
  pyt_desc: string | null;
  pyt_count: number | null;
}

export interface SettingsUpdatePayload {
  settings: {
    set_din?: string;
    set_dbin?: string;
    set_dbout?: string;
    set_dout?: string;
    set_timeout?: string;
    set_graceperiod?: string;
    set_timeoffset?: string;
    set_minin?: string;
    set_ndst?: string;
    set_nden?: string;
    set_extid?: number;
    set_flex?: number;
    set_biobreak?: number;
    set_period?: number;
    set_user?: number;
    set_terminal?: number;
    set_device?: number;
    set_coabefore?: number;
    set_coaafter?: number;
    set_utmlead?: number;
    set_utmafter?: number;
    set_otmbefore?: number;
    set_otmafter?: number;
    set_scabefore?: number;
    set_scaafter?: number;
    set_yrdays?: number;
    set_wkdays?: number;
    set_halfmon?: number;
    set_includes?: number;
  };
  company: {
    com_name?: string;
    com_address?: string;
    com_email?: string;
    com_cntter?: number;
    com_cntmob?: number;
  };
}

export function usePeriodTypes() {
  return useQuery<PeriodTypeDTO[], ApiError>({
    queryKey: ["settings", "period-types"],
    queryFn: () =>
      apiFetch<PeriodTypeDTO[]>("/settings/period-types", { headers: authHeader() }),
    staleTime: 30 * 60 * 1000,
  });
}

export function useAdminSettings() {
  return useQuery<SettingsDTO, ApiError>({
    queryKey: ["settings"],
    queryFn: () =>
      apiFetch<SettingsDTO>("/settings", { headers: authHeader() }),
    staleTime: 5 * 60 * 1000,
  });
}

export function useAdminCompany() {
  return useQuery<CompanyDTO, ApiError>({
    queryKey: ["settings", "company"],
    queryFn: () =>
      apiFetch<CompanyDTO>("/settings/company", { headers: authHeader() }),
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation<{ message: string }, ApiError, SettingsUpdatePayload>({
    mutationFn: (payload) =>
      apiFetch<{ message: string }>("/settings", {
        method: "PUT",
        headers: { ...authHeader(), "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
  });
}
