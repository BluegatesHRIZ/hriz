"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { apiFetch, ApiError } from "@/lib/api/client";
import { queryKeys } from "@/lib/hooks/queries";
import type {
  HdmfContributionRow,
  PhicContributionRow,
  SssContributionRow,
} from "@/lib/services/contributions.service";
import type { Paginated } from "@/lib/pagination";
import { REPORT_DEFAULT_LIMIT } from "@/lib/pagination";

function getToken(): string {
  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
  if (!token) throw new ApiError("No token found", 401);
  return token;
}

function contributionQuery(emp: string, page: number, limit: number): string {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (emp !== "All") params.set("emp", emp);
  return params.toString();
}

export function useSssContribution(
  year: string | null,
  emp = "All",
  page = 1,
  limit = REPORT_DEFAULT_LIMIT,
) {
  return useQuery<Paginated<SssContributionRow>, ApiError>({
    queryKey: [...queryKeys.contributions.sss(year ?? "", emp), page, limit],
    queryFn: async () => {
      const token = getToken();
      return apiFetch<Paginated<SssContributionRow>>(
        `/contributions/sss/${year}?${contributionQuery(emp, page, limit)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
    },
    enabled: Boolean(year),
    placeholderData: keepPreviousData,
  });
}

export function useHdmfContribution(
  year: string | null,
  emp = "All",
  page = 1,
  limit = REPORT_DEFAULT_LIMIT,
) {
  return useQuery<Paginated<HdmfContributionRow>, ApiError>({
    queryKey: [...queryKeys.contributions.hdmf(year ?? "", emp), page, limit],
    queryFn: async () => {
      const token = getToken();
      return apiFetch<Paginated<HdmfContributionRow>>(
        `/contributions/hdmf/${year}?${contributionQuery(emp, page, limit)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
    },
    enabled: Boolean(year),
    placeholderData: keepPreviousData,
  });
}

export function usePhicContribution(
  year: string | null,
  emp = "All",
  page = 1,
  limit = REPORT_DEFAULT_LIMIT,
) {
  return useQuery<Paginated<PhicContributionRow>, ApiError>({
    queryKey: [...queryKeys.contributions.phic(year ?? "", emp), page, limit],
    queryFn: async () => {
      const token = getToken();
      return apiFetch<Paginated<PhicContributionRow>>(
        `/contributions/phic/${year}?${contributionQuery(emp, page, limit)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
    },
    enabled: Boolean(year),
    placeholderData: keepPreviousData,
  });
}
