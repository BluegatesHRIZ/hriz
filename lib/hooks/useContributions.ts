"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch, ApiError } from "@/lib/api/client";
import { queryKeys } from "@/lib/hooks/queries";
import type {
  HdmfContributionRow,
  PhicContributionRow,
  SssContributionRow,
} from "@/lib/services/contributions.service";

function getToken(): string {
  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
  if (!token) throw new ApiError("No token found", 401);
  return token;
}

export function useSssContribution(year: string | null, emp = "All") {
  return useQuery<SssContributionRow[], ApiError>({
    queryKey: queryKeys.contributions.sss(year ?? "", emp),
    queryFn: async () => {
      const token = getToken();
      const qs = emp !== "All" ? `?emp=${encodeURIComponent(emp)}` : "";
      return apiFetch<SssContributionRow[]>(`/contributions/sss/${year}${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    },
    enabled: Boolean(year),
  });
}

export function useHdmfContribution(year: string | null, emp = "All") {
  return useQuery<HdmfContributionRow[], ApiError>({
    queryKey: queryKeys.contributions.hdmf(year ?? "", emp),
    queryFn: async () => {
      const token = getToken();
      const qs = emp !== "All" ? `?emp=${encodeURIComponent(emp)}` : "";
      return apiFetch<HdmfContributionRow[]>(`/contributions/hdmf/${year}${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    },
    enabled: Boolean(year),
  });
}

export function usePhicContribution(year: string | null, emp = "All") {
  return useQuery<PhicContributionRow[], ApiError>({
    queryKey: queryKeys.contributions.phic(year ?? "", emp),
    queryFn: async () => {
      const token = getToken();
      const qs = emp !== "All" ? `?emp=${encodeURIComponent(emp)}` : "";
      return apiFetch<PhicContributionRow[]>(`/contributions/phic/${year}${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    },
    enabled: Boolean(year),
  });
}
