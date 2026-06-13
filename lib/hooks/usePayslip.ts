"use client";

import { useQuery } from "@tanstack/react-query";
import { ApiError, apiFetch } from "@/lib/api/client";
import type { UserPayslipDTO } from "@/app/api/payroll/payslips/route";

export type { UserPayslipDTO };

function authHeader(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
  if (!token) throw new ApiError("No token found", 401);
  return { Authorization: `Bearer ${token}` };
}

export function useUserPayslips() {
  return useQuery<UserPayslipDTO[], ApiError>({
    queryKey: ["payslips", "user"],
    queryFn: () =>
      apiFetch<UserPayslipDTO[]>("/payroll/payslips", { headers: authHeader() }),
  });
}

/** Client-side computed net pay from a payslip row */
export function computeNetPay(p: UserPayslipDTO): {
  netEarnings: number;
  netPay: number;
} {
  const netEarnings =
    (p.pyd_salary + p.pyd_comp) -
    (p.pyd_deduct + p.pyd_tax + p.pyd_sss + p.pyd_phic + p.pyd_hdmf);
  const netPay = netEarnings + p.otherEarnings - p.otherDeductions - p.pyd_tloan;
  return { netEarnings, netPay };
}
