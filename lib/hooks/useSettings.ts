"use client"

import { useQuery } from "@tanstack/react-query"
import { apiFetch, ApiError } from "@/lib/api/client"

export interface SettingsDTO {
  set_id: string | null
  set_din: Date | null
  set_dbin: Date | null
  set_dbout: Date | null
  set_dout: Date | null
  set_timeout: Date | null
  set_graceperiod: Date | null
  set_extid: number
  set_beta: string | null
  set_user: number | null
  set_terminal: number | null
  set_device: number | null
  set_timeoffset: Date | null
  set_coabefore: number | null
  set_coaafter: number | null
  set_utmlead: number | null
  set_utmafter: number | null
  set_otmbefore: number | null
  set_otmafter: number | null
  set_scabefore: number | null
  set_scaafter: number | null
  set_ndst: Date | null
  set_nden: Date | null
  set_yrdays: number | null
  set_wkdays: number | null
  set_halfmon: number | null
  set_includes: number | null
  set_flex: number | null
  set_period: number | null
  set_biobreak: number | null
  set_minin: Date | null
}

export interface CompanyDTO {
  com_id: string
  com_name: string | null
  com_address: string | null
  com_datestart: Date | null
  com_dateend: Date | null
  com_cntter: number | null
  com_cntmob: number | null
  com_logopath: string | null
  com_email: string | null
}

/**
 * Hook for fetching system settings
 */
export function useSettings() {
  return useQuery<SettingsDTO, ApiError>({
    queryKey: ["settings"],
    queryFn: async () => {
      return apiFetch<SettingsDTO>("/settings")
    },
    staleTime: 10 * 60 * 1000, // 10 minutes - settings don't change often
  })
}

/**
 * Hook for fetching company settings
 */
export function useCompanySettings() {
  return useQuery<CompanyDTO, ApiError>({
    queryKey: ["settings", "company"],
    queryFn: async () => {
      return apiFetch<CompanyDTO>("/settings/company")
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  })
}
