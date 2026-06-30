"use client";

import {
  useMutation,
  useQuery,
  keepPreviousData,
  type UseMutationOptions,
} from "@tanstack/react-query";
import { apiFetch, ApiError } from "@/lib/api/client";
import { queryKeys } from "@/lib/hooks/queries";
import type { Paginated } from "@/lib/pagination";
import { REPORT_DEFAULT_LIMIT } from "@/lib/pagination";

/**
 * React Query hooks + DTO mirrors for the Reports module. The date-range /
 * single-date reports are exposed as `useMutation` to match the "Apply Request"
 * UX from the Blazor pages (user clicks a button, we POST filters, render the
 * result). Results are **server-side paginated** — the mutation variables carry
 * `page`/`limit` (in the query string) and the response is `Paginated<T>`; page
 * navigation simply re-runs the mutation with the next page. Payroll is a
 * `useQuery` keyed on year + page because the C# controller exposes it as a GET.
 */

/** Pagination params for a report request (page in the query string). */
export interface ReportPageArgs {
  page?: number;
  limit?: number;
}

function reportQuery(page = 1, limit = REPORT_DEFAULT_LIMIT): string {
  return new URLSearchParams({ page: String(page), limit: String(limit) }).toString();
}

export interface AttendanceReportFilters {
  from: string;
  to: string;
  location?: string[];
  department?: string[];
  position?: string[];
}

export interface AttendanceEmployeeDetailDTO {
  EmpId: string | null;
  EmpDate: string | null;
  EmpDay: string | null;
  EmpShift: string | null;
  EmpSchedule: string | null;
  EmpClockedinandout: string | null;
  EmpClockedhours: number | null;
  EmpLate: number | null;
  EmpRegularhours: number | null;
  EmpUndertime: number | null;
  EmpOvertime: number | null;
  EmpPaidHours: number | null;
  AttExcess: string | null;
  AttOt: string | null;
  AttNd: string | null;
  AttNdot: string | null;
  AttRd: string | null;
  AttRdot: string | null;
  AttRdnd: string | null;
  AttRdndot: string | null;
  AttSh: string | null;
  AttShot: string | null;
  AttShnd: string | null;
  AttShndot: string | null;
  AttShrd: string | null;
  AttShrdot: string | null;
  AttShrdnd: string | null;
  AttShrdndot: string | null;
  AttLh: string | null;
  AttLhot: string | null;
  AttLhnd: string | null;
  AttLhndot: string | null;
  AttLhrd: string | null;
  AttLhrdot: string | null;
  AttLhrdnd: string | null;
  AttLhrdndot: string | null;
  AttDh: string | null;
  AttDhot: string | null;
  AttDhnd: string | null;
  AttDhndot: string | null;
  AttDhrd: string | null;
  AttDhrdot: string | null;
  AttDhrdnd: string | null;
  AttDhrdndot: string | null;
}

export interface AttendanceEmployeeHeaderDTO {
  EmpId: string | null;
  ProfPic: string | null;
  EmpDepartment: string | null;
  EmpPosition: string | null;
  EmpLocation: string | null;
  EmpFullname: string | null;
  EmpWorkday: number | null;
  EmpPresent: number | null;
  EmpAbsent: number | null;
  EmpRestday: number | null;
  EmpLeave: number | null;
  EmpHoliday: number | null;
  EmpHoursworked: number | null;
  LateUT: number | null;
  OT: number | null;
  AttExcess: string | null;
  AttOt: string | null;
  AttNd: string | null;
  AttNdot: string | null;
  AttRd: string | null;
  AttRdot: string | null;
  AttRdnd: string | null;
  AttRdndot: string | null;
  AttSh: string | null;
  AttShot: string | null;
  AttShnd: string | null;
  AttShndot: string | null;
  AttShrd: string | null;
  AttShrdot: string | null;
  AttShrdnd: string | null;
  AttShrdndot: string | null;
  AttLh: string | null;
  AttLhot: string | null;
  AttLhnd: string | null;
  AttLhndot: string | null;
  AttLhrd: string | null;
  AttLhrdot: string | null;
  AttLhrdnd: string | null;
  AttLhrdndot: string | null;
  AttDh: string | null;
  AttDhot: string | null;
  AttDhnd: string | null;
  AttDhndot: string | null;
  AttDhrd: string | null;
  AttDhrdot: string | null;
  AttDhrdnd: string | null;
  AttDhrdndot: string | null;
  AttendanceDetails: AttendanceEmployeeDetailDTO[];
}

export interface LeaveReportRow {
  lea_sid: string | null;
  lev_desc: string | null;
  lea_sfrom: string | null;
  lea_sto: string | null;
  lea_sreason: string | null;
  lea_swithpay: string | number | null;
  lea_swithoutpay: string | number | null;
  lea_semp: string | null;
  lea_sapplieddate: string | null;
  name: string | null;
  department: string | null;
  location: string | null;
  status: string | null;
}

export interface OvertimeReportRow {
  otm_id: string | null;
  name: string | null;
  otm_date: string | null;
  otm_from: string | null;
  otm_to: string | null;
  reason: string | null;
  otm_applieddate: string | null;
  department: string | null;
  location: string | null;
  status: string | null;
  att_excess: string | null;
  att_ot: string | null;
  att_nd: string | null;
  att_ndot: string | null;
  att_rd: string | null;
  att_rdot: string | null;
  att_rdnd: string | null;
  att_rdndot: string | null;
  att_sh: string | null;
  att_shot: string | null;
  att_shnd: string | null;
  att_shndot: string | null;
  att_shrd: string | null;
  att_shrdot: string | null;
  att_shrdnd: string | null;
  att_shrdndot: string | null;
  att_lh: string | null;
  att_lhot: string | null;
  att_lhnd: string | null;
  att_lhndot: string | null;
  att_lhrd: string | null;
  att_lhrdot: string | null;
  att_lhrdnd: string | null;
  att_lhrdndot: string | null;
  att_dh: string | null;
  att_dhot: string | null;
  att_dhnd: string | null;
  att_dhndot: string | null;
  att_dhrd: string | null;
  att_dhrdot: string | null;
  att_dhrdnd: string | null;
  att_dhrdndot: string | null;
}

export interface PayrollReportHeaderDTO {
  PyhCode: string | null;
  PyhDesc: string | null;
  BaseSalary: number | null;
  TotalCompensation: number | null;
  TotalDeduction: number | null;
  Tax: number | null;
  Sss: number | null;
  Philhealth: number | null;
  Hdmf: number | null;
  SssEmployer: number | null;
  PhilhealthEmployer: number | null;
  HdmfEmployer: number | null;
  TaxAdjusted: number | null;
}

export interface PayrollReportAmountDTO {
  PydPk: string | null;
  PydCode: string | null;
  PyaDef: string | null;
  CdDesc: string | null;
  CdType: string | null;
  PayAmount: number | null;
}

export interface PayrollReportRow {
  Payreport: PayrollReportHeaderDTO;
  PayAmount: PayrollReportAmountDTO[];
}

export interface DailyLogRow {
  AttDate: string | null;
  EmpId: string | null;
  EmpName: string | null;
  EmpSched: string | null;
  EmpTimeIn: string | null;
  EmpTimeOut: string | null;
  DepDesc: string | null;
  PstDesc: string | null;
  LocDesc: string | null;
  InIp: string | null;
  OutIp: string | null;
  InLoc: string | null;
  OutLoc: string | null;
}

function getToken(): string {
  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
  if (!token) throw new ApiError("No token found", 401);
  return token;
}

/**
 * Attendance Report - POST filters, returns the merged header + detail rows.
 * Mirrors `AttendanceReport.razor`'s "Apply Request" button (generates) and
 * "Refresh from data" button (lists without re-running the attendance proc).
 */
export function useAttendanceReport(
  options?: UseMutationOptions<
    Paginated<AttendanceEmployeeHeaderDTO>,
    ApiError,
    { filters: AttendanceReportFilters; mode?: "generate" | "list" } & ReportPageArgs
  >,
) {
  return useMutation<
    Paginated<AttendanceEmployeeHeaderDTO>,
    ApiError,
    { filters: AttendanceReportFilters; mode?: "generate" | "list" } & ReportPageArgs
  >({
    mutationFn: async ({ filters, mode = "generate", page, limit }) => {
      const token = getToken();
      // "generate" runs the mutating proc once (on Apply); paging uses the
      // read-only "list" endpoint so the attendance table isn't recomputed.
      const endpoint =
        mode === "generate"
          ? "/reports/attendance/generate"
          : "/reports/attendance/list";
      return apiFetch<Paginated<AttendanceEmployeeHeaderDTO>>(
        `${endpoint}?${reportQuery(page, limit)}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: filters as unknown as Record<string, unknown>,
        },
      );
    },
    ...options,
  });
}

export function useLeaveReport(
  options?: UseMutationOptions<
    Paginated<LeaveReportRow>,
    ApiError,
    { from: string; to: string; emp?: string } & ReportPageArgs
  >,
) {
  return useMutation<
    Paginated<LeaveReportRow>,
    ApiError,
    { from: string; to: string; emp?: string } & ReportPageArgs
  >({
    mutationFn: async ({ page, limit, ...filters }) => {
      const token = getToken();
      return apiFetch<Paginated<LeaveReportRow>>(
        `/reports/leave?${reportQuery(page, limit)}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: filters as unknown as Record<string, unknown>,
        },
      );
    },
    ...options,
  });
}

export function useOvertimeReport(
  options?: UseMutationOptions<
    Paginated<OvertimeReportRow>,
    ApiError,
    { from: string; to: string; emp?: string } & ReportPageArgs
  >,
) {
  return useMutation<
    Paginated<OvertimeReportRow>,
    ApiError,
    { from: string; to: string; emp?: string } & ReportPageArgs
  >({
    mutationFn: async ({ page, limit, ...filters }) => {
      const token = getToken();
      return apiFetch<Paginated<OvertimeReportRow>>(
        `/reports/overtime?${reportQuery(page, limit)}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: filters as unknown as Record<string, unknown>,
        },
      );
    },
    ...options,
  });
}

/**
 * Payroll Report - keyed on year + page. C# exposes this as a GET, so we match
 * by using `useQuery` with the year embedded in the URL path; server-side
 * paginated by pay-header group.
 */
export function usePayrollReport(
  year: string | null,
  page = 1,
  limit = REPORT_DEFAULT_LIMIT,
) {
  return useQuery<Paginated<PayrollReportRow>, ApiError>({
    queryKey: [...queryKeys.reports.payroll(year ?? ""), page, limit],
    queryFn: async () => {
      const token = getToken();
      return apiFetch<Paginated<PayrollReportRow>>(
        `/reports/payroll/${year}?${reportQuery(page, limit)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
    },
    enabled: Boolean(year),
    placeholderData: keepPreviousData,
  });
}

export function useDailyLogReport(
  options?: UseMutationOptions<
    Paginated<DailyLogRow>,
    ApiError,
    { date: string; emp?: string } & ReportPageArgs
  >,
) {
  return useMutation<
    Paginated<DailyLogRow>,
    ApiError,
    { date: string; emp?: string } & ReportPageArgs
  >({
    mutationFn: async ({ page, limit, ...filters }) => {
      const token = getToken();
      return apiFetch<Paginated<DailyLogRow>>(
        `/reports/dailylog?${reportQuery(page, limit)}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: filters as unknown as Record<string, unknown>,
        },
      );
    },
    ...options,
  });
}

export interface UndertimeReportRow {
  utm_id: string | null;
  name: string | null;
  utm_date: string | null;
  utm_from: string | null;
  utm_to: string | null;
  utm_reason: string | null;
  utm_applieddate: string | null;
  status: string | null;
}

export interface ScheduleChangeReportRow {
  sca_did: string | null;
  name: string | null;
  sca_ddate: string | null;
  sca_dshiftstart: string | null;
  sca_dshiftend: string | null;
  sca_dbreakstart: string | null;
  sca_dbreakend: string | null;
  sca_drest: string | null;
  att_schin: string | null;
  att_schout: string | null;
  att_schbin: string | null;
  att_schbout: string | null;
  att_restday: string | null;
  status: string | null;
}

export interface CoaReportRow {
  name: string | null;
  coa_did: string | null;
  coa_dtype: string | null;
  coa_ddate: string | null;
  coa_dtime: string | null;
  coa_stypedetail: string | null;
  coa_sreason: string | null;
  status: string | null;
}

export interface BiologReportRow {
  bio_date: string | null;
  bio_emp: string | null;
  bio_type: string | null;
  bio_time: string | null;
  bio_loc: string | null;
  bio_ip: string | null;
}

export function useUndertimeReport(
  options?: UseMutationOptions<
    Paginated<UndertimeReportRow>,
    ApiError,
    { from: string; to: string; emp?: string } & ReportPageArgs
  >,
) {
  return useMutation<
    Paginated<UndertimeReportRow>,
    ApiError,
    { from: string; to: string; emp?: string } & ReportPageArgs
  >({
    mutationFn: async ({ page, limit, ...filters }) => {
      const token = getToken();
      return apiFetch<Paginated<UndertimeReportRow>>(
        `/reports/undertime?${reportQuery(page, limit)}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: filters as unknown as Record<string, unknown>,
        },
      );
    },
    ...options,
  });
}

export function useScheduleChangeReport(
  options?: UseMutationOptions<
    Paginated<ScheduleChangeReportRow>,
    ApiError,
    { from: string; to: string; emp?: string } & ReportPageArgs
  >,
) {
  return useMutation<
    Paginated<ScheduleChangeReportRow>,
    ApiError,
    { from: string; to: string; emp?: string } & ReportPageArgs
  >({
    mutationFn: async ({ page, limit, ...filters }) => {
      const token = getToken();
      return apiFetch<Paginated<ScheduleChangeReportRow>>(
        `/reports/schedule-change?${reportQuery(page, limit)}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: filters as unknown as Record<string, unknown>,
        },
      );
    },
    ...options,
  });
}

export function useCoaReport(
  options?: UseMutationOptions<
    Paginated<CoaReportRow>,
    ApiError,
    { from: string; to: string; emp?: string } & ReportPageArgs
  >,
) {
  return useMutation<
    Paginated<CoaReportRow>,
    ApiError,
    { from: string; to: string; emp?: string } & ReportPageArgs
  >({
    mutationFn: async ({ page, limit, ...filters }) => {
      const token = getToken();
      return apiFetch<Paginated<CoaReportRow>>(
        `/reports/attendance-change?${reportQuery(page, limit)}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: filters as unknown as Record<string, unknown>,
        },
      );
    },
    ...options,
  });
}

export function useBiologReport(
  options?: UseMutationOptions<
    Paginated<BiologReportRow>,
    ApiError,
    { from: string; to: string } & ReportPageArgs
  >,
) {
  return useMutation<
    Paginated<BiologReportRow>,
    ApiError,
    { from: string; to: string } & ReportPageArgs
  >({
    mutationFn: async ({ page, limit, ...filters }) => {
      const token = getToken();
      return apiFetch<Paginated<BiologReportRow>>(
        `/reports/biolog?${reportQuery(page, limit)}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: filters as unknown as Record<string, unknown>,
        },
      );
    },
    ...options,
  });
}

/**
 * Generic .xlsx download helper. Posts the report **filters** (not the rendered
 * rows) to the matching `/export` endpoint, which re-fetches the full dataset
 * server-side, builds the workbook, and returns the blob. Triggers a browser
 * download via a temporary `<a>` element + `URL.createObjectURL`.
 */
export function useDownloadReportXlsx() {
  return useMutation<
    void,
    ApiError,
    { endpoint: string; body: Record<string, unknown>; filename: string }
  >({
    mutationFn: async ({ endpoint, body, filename }) => {
      const token = getToken();
      const response = await fetch(`/api${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...body, filename }),
      });
      if (!response.ok) {
        let message = response.statusText || "Export failed";
        try {
          const data = (await response.json()) as { message?: string };
          message = data.message ?? message;
        } catch {
          // keep statusText
        }
        throw new ApiError(message, response.status);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    },
  });
}
