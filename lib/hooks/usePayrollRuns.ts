import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, ApiError } from "@/lib/api/client";
import type { Paginated } from "@/lib/pagination";

/** Data hooks for the Run Payroll module (`/payroll`). */

export interface PayrollRun {
  code: string;
  createdBy: string | null;
  description: string | null;
  month: number | null;
  year: number | null;
  period: number | null;
  from: string | null;
  to: string | null;
  status: string | null;
  postedBy: string | null;
  postedDate: string | null;
  slipCount: number;
}

export interface PayrollSlip {
  pk: string;
  employee: string | null;
  name: string | null;
  basic: number;
  premiums: number;
  timeDeductions: number;
  tax: number;
  sss: number;
  phic: number;
  hdmf: number;
  loans: number;
  netEarnings: number;
  otherEarnings: number;
  otherDeductions: number;
  gross: number;
  deductions: number;
  net: number;
}

export interface PayrollRunDetail {
  run: {
    code: string;
    description: string | null;
    from: string | null;
    to: string | null;
    status: string | null;
    postedBy: string | null;
    postedDate: string | null;
  };
  slips: PayrollSlip[];
  totals: { gross: number; deductions: number; net: number };
}

/** Full / Half / None, as the legacy Run Payroll dialog offers. */
export type ContributionFlag = "2" | "1" | "0";

export interface CreateRunInput {
  month: number;
  year: number;
  period: number;
  from: string;
  to: string;
  description?: string;
  type?: string;
  loan?: boolean;
  /** With ("2") / Without ("0") — tax has no half. */
  tax?: "2" | "0";
  sss?: ContributionFlag;
  philhealth?: ContributionFlag;
  pagibig?: ContributionFlag;
  /** "save" parks the header at status 5; "generate" leaves it unposted. */
  action?: "save" | "generate";
}

/** One row of `/api/employee/list/all`, as the selection grid consumes it. */
export interface PayrollEmployee {
  id: string;
  name: string;
  location: string | null;
  department: string | null;
  position: string | null;
  /** Has an active `empsalary` record — compute skips employees without one. */
  payable: boolean;
}

/** The raw shape `/api/employee/list/all` returns. */
interface EmployeeListRow {
  emp_id: string;
  emp_first: string | null;
  emp_last: string | null;
  emp_mid: string | null;
  emp_dept_desc: string | null;
  emp_pos_desc: string | null;
  emp_loc_desc: string | null;
  has_salary: boolean;
}

function toPayrollEmployee(r: EmployeeListRow): PayrollEmployee {
  return {
    id: r.emp_id,
    name: [r.emp_last, r.emp_first].filter(Boolean).join(", ") || r.emp_id,
    location: r.emp_loc_desc,
    department: r.emp_dept_desc,
    position: r.emp_pos_desc,
    payable: r.has_salary,
  };
}

export interface PayrollTypeOption {
  pyt_code: string;
  pyt_desc: string | null;
}

/**
 * `pay_header.pyh_status`, labelled exactly as the legacy grid did.
 * Anything else showed as "Undefined".
 */
export const RUN_STATUS_LABEL: Record<string, string> = {
  "0": "Unposted",
  "1": "Posted",
  "5": "Saved",
};

/** "1st Period", "2nd Period" — matches the legacy ordinal display. */
export function ordinalPeriod(period: number | null): string {
  if (period === null || period === undefined) return "";
  const n = period % 100;
  const suffix =
    n >= 11 && n <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th";
  return `${period}${suffix} Period`;
}

function authHeaders() {
  const token = localStorage.getItem("auth_token");
  if (!token) throw new ApiError("No token found", 401);
  return { Authorization: `Bearer ${token}` };
}

export const payrollKeys = {
  runs: (year?: number) => ["payroll", "runs", year ?? "all"] as const,
  run: (code: string) => ["payroll", "run", code] as const,
  employees: ["payroll", "employees"] as const,
  types: ["payroll", "types"] as const,
};

export function usePayrollRuns(year?: number) {
  return useQuery({
    queryKey: payrollKeys.runs(year),
    queryFn: async () => {
      const qs = year ? `?year=${year}` : "";
      const data = await apiFetch<{ runs: PayrollRun[] }>(`/payroll/runs${qs}`, {
        headers: authHeaders(),
      });
      return data.runs;
    },
  });
}

export interface PayrollEmployeeFilters {
  page?: number;
  limit?: number;
  search?: string;
  dept?: string;
  loc?: string;
  pos?: string;
}

function employeeQuery(f: PayrollEmployeeFilters): string {
  const params = new URLSearchParams();
  params.set("page", String(f.page ?? 1));
  params.set("limit", String(f.limit ?? 10));
  if (f.search?.trim()) params.set("search", f.search.trim());
  if (f.dept) params.set("dept", f.dept);
  if (f.loc) params.set("loc", f.loc);
  if (f.pos) params.set("pos", f.pos);
  return params.toString();
}

/**
 * Employees available for selection in the Run Payroll dialog.
 *
 * Backed by the shared `/api/employee/list/all` endpoint rather than a
 * payroll-specific one — it already paginates server-side and joins the
 * department/location/position descriptions.
 */
export function usePayrollEmployees(filters: PayrollEmployeeFilters) {
  return useQuery({
    queryKey: [...payrollKeys.employees, filters],
    queryFn: async () => {
      const res = await apiFetch<Paginated<EmployeeListRow>>(
        `/employee/list/all?${employeeQuery(filters)}`,
        { headers: authHeaders() },
      );
      return { ...res, data: res.data.map(toPayrollEmployee) };
    },
    // Keep the previous page visible while the next one loads, so the table
    // does not collapse to a spinner on every page change.
    placeholderData: (prev) => prev,
  });
}

/**
 * Every id matching the current filters, for "select all N matching".
 * Fetched on demand rather than with the table.
 */
export function useAllMatchingEmployeeIds() {
  return useMutation({
    mutationFn: async (filters: PayrollEmployeeFilters) => {
      const params = new URLSearchParams(employeeQuery({ ...filters, page: 1 }));
      params.set("idsOnly", "1");
      const data = await apiFetch<{ ids: string[] }>(
        `/employee/list/all?${params.toString()}`,
        { headers: authHeaders() },
      );
      return data.ids;
    },
  });
}

/** `paytypes` — Regular, Final Pay, 13th Month, ... */
export function usePayrollTypes() {
  return useQuery({
    queryKey: payrollKeys.types,
    queryFn: () =>
      apiFetch<PayrollTypeOption[]>("/payroll/types", { headers: authHeaders() }),
  });
}

export function useDeletePayrollRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) =>
      apiFetch<{ deleted: boolean }>(`/payroll/runs/${code}`, {
        method: "DELETE",
        headers: authHeaders(),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payroll", "runs"] }),
  });
}

export function usePayrollRun(code: string | null) {
  return useQuery({
    queryKey: payrollKeys.run(code ?? ""),
    enabled: Boolean(code),
    queryFn: () =>
      apiFetch<PayrollRunDetail>(`/payroll/runs/${code}`, { headers: authHeaders() }),
  });
}

export function useCreatePayrollRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRunInput) =>
      apiFetch<{ code: string }>("/payroll/runs", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payroll", "runs"] }),
  });
}

/** compute / post / unpost all share a shape, so one factory covers them. */
function useRunAction(action: "post" | "unpost") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) =>
      apiFetch<Record<string, unknown>>(`/payroll/runs/${code}/${action}`, {
        method: "POST",
        headers: authHeaders(),
      }),
    onSuccess: (_data, code) => {
      qc.invalidateQueries({ queryKey: ["payroll", "runs"] });
      qc.invalidateQueries({ queryKey: payrollKeys.run(code) });
    },
  });
}

/**
 * Generate. Passing `employees` sets who the run covers; omitting it reuses
 * whoever was in the run last time, so a recompute never widens the payroll.
 */
export function useComputeRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ code, employees }: { code: string; employees?: string[] }) =>
      apiFetch<{ computed: number; skipped: Array<{ employee: string; reason: string }> }>(
        `/payroll/runs/${code}/compute`,
        {
          method: "POST",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ employees }),
        },
      ),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["payroll", "runs"] });
      qc.invalidateQueries({ queryKey: payrollKeys.run(vars.code) });
    },
  });
}
export const usePostRun = () => useRunAction("post");
export const useUnpostRun = () => useRunAction("unpost");

// ---------------------------------------------------- pay components -------

/** A `comded` row — `taxable` is the checkbox that drives the tax base. */
export interface PayComponentRule {
  cd_code: string;
  cd_desc: string | null;
  cd_type: string | null;
  cd_ord: number | null;
  cd_tax: number | null;
  cd_slip: string | null;
}

export const comdedKey = ["payroll", "comded"] as const;

export function usePayComponents() {
  return useQuery({
    queryKey: comdedKey,
    queryFn: () =>
      apiFetch<PayComponentRule[]>("/payroll/comded", { headers: authHeaders() }),
  });
}

export function useUpdatePayComponents() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (updates: Array<{ code: string; taxable: boolean }>) =>
      apiFetch<{ updated: number }>("/payroll/comded", {
        method: "PATCH",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: comdedKey }),
  });
}

// ------------------------------------------------ payslip drill-in ---------

/** One `pay_amounts` line on a payslip. */
export interface PayslipLine {
  counter: number;
  code: string;
  label: string;
  type: "C" | "D";
  description: string;
  amount: number;
  employerAmount: number;
  taxable: boolean;
  isAdjustment: boolean;
}

export interface PayslipComponent {
  cd_code: string;
  cd_desc: string | null;
  cd_type: string | null;
  cd_tax: number | null;
}

export interface PayslipDetail {
  slip: {
    pk: string;
    code: string;
    employee: string | null;
    name: string | null;
    salary: number;
    tax: number;
    sss: number;
    phic: number;
    hdmf: number;
    loans: number;
    posted: boolean;
  };
  lines: PayslipLine[];
  loans: Array<{ advanceId: string; amount: number; balance: number }>;
  components: PayslipComponent[];
}

/** An editable adjustment row in the drill-in dialog. */
export interface AdjustmentInput {
  code: string;
  type: "C" | "D";
  description: string;
  amount: number;
  taxable: boolean;
}

export const payslipKey = (code: string, pk: string) =>
  ["payroll", "slip", code, pk] as const;

export function usePayslipDetail(code: string, pk: string | null) {
  return useQuery({
    queryKey: payslipKey(code, pk ?? ""),
    enabled: Boolean(pk),
    queryFn: () =>
      apiFetch<PayslipDetail>(`/payroll/runs/${code}/slips/${pk}`, {
        headers: authHeaders(),
      }),
  });
}

/**
 * Replace a payslip's adjustments. Totals and tax only move once the run is
 * regenerated, which is why the response carries `needsRegenerate`.
 */
export function useSaveAdjustments(code: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ pk, adjustments }: { pk: string; adjustments: AdjustmentInput[] }) =>
      apiFetch<{ saved: number; needsRegenerate: boolean }>(
        `/payroll/runs/${code}/slips/${pk}`,
        {
          method: "PUT",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ adjustments }),
        },
      ),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: payslipKey(code, vars.pk) });
      qc.invalidateQueries({ queryKey: payrollKeys.run(code) });
    },
  });
}
