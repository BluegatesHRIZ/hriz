"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, ApiError } from "@/lib/api/client";
import { queryKeys } from "./queries";

// ==================== LEAVE REQUESTS ====================

export interface LeaveType {
  lev_id?: string;
  lev_desc?: string | null;
  lev_days?: number | null;
  lev_before?: number | null;
  lev_after?: number | null;
  lev_lead?: number | null;
  [key: string]: any;
}

export function useLeaveTypes() {
  return useQuery<LeaveType[], ApiError>({
    queryKey: queryKeys.leave.types(),
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new ApiError("No token found", 401);
      return apiFetch<LeaveType[]>("/leave/types", {
        headers: { Authorization: `Bearer ${token}` },
      });
    },
    staleTime: 10 * 60 * 1000,
    enabled:
      typeof window !== "undefined" && !!localStorage.getItem("auth_token"),
  });
}

/**
 * Leave types available for a specific employee (used in leave request form).
 * Mirrors C# GetLeaveTypesEmpl – only returns types the employee is entitled to.
 */
export function useEmployeeLeaveTypes(empId: string) {
  return useQuery<LeaveType[], ApiError>({
    queryKey: queryKeys.leave.typesForEmployee(empId),
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new ApiError("No token found", 401);
      return apiFetch<LeaveType[]>(`/leave/types/empleave/${empId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    },
    staleTime: 10 * 60 * 1000,
    enabled:
      !!empId &&
      typeof window !== "undefined" &&
      !!localStorage.getItem("auth_token"),
  });
}

export interface LeaveDate {
  LeaveDate?: Date;
  [key: string]: any;
}

export interface LeaveRequestDTO {
  LeaSid?: string;
  LeaSemp?: string;
  LeaStype?: string;
  LeaSfrom?: Date | string;
  LeaSto?: Date | string;
  LeaSreason?: string;
  LeaSwithpay?: number;
  LeaSwithoutpay?: number;
  leavedetail?: LeaveDetailDTO[];
  files?: any[];
  [key: string]: any;
}

export interface LeaveDetailDTO {
  LeaDdate?: Date | string;
  LeaDtype?: string;
  LeaDampm?: string;
  [key: string]: any;
}

export interface LeaveCreditDTO {
  EmlEmp?: string;
  EmlLeave?: string;
  EmlLeacredit?: number;
  EmlUsed?: number;
  [key: string]: any;
}

export function useLeaveYear() {
  return useQuery<LeaveDate[], ApiError>({
    queryKey: queryKeys.leave.year(),
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new ApiError("No token found", 401);
      return apiFetch<LeaveDate[]>("/leave/year", {
        headers: { Authorization: `Bearer ${token}` },
      });
    },
    staleTime: 5 * 60 * 1000,
    enabled:
      typeof window !== "undefined" && !!localStorage.getItem("auth_token"),
  });
}

export function useLeaveSummary(id: string) {
  return useQuery<LeaveRequestDTO, ApiError>({
    queryKey: queryKeys.leave.summary(id),
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new ApiError("No token found", 401);
      return apiFetch<LeaveRequestDTO>(`/leave/list/summary/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    },
    enabled:
      !!id &&
      typeof window !== "undefined" &&
      !!localStorage.getItem("auth_token"),
  });
}

export function useUserLeaves(empId: string) {
  return useQuery<LeaveRequestDTO[], ApiError>({
    queryKey: queryKeys.leave.user(empId),
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new ApiError("No token found", 401);
      return apiFetch<LeaveRequestDTO[]>(`/leave/user/${empId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    },
    enabled:
      !!empId &&
      typeof window !== "undefined" &&
      !!localStorage.getItem("auth_token"),
  });
}

export function useLeaveCredits(empId: string) {
  return useQuery<LeaveCreditDTO[], ApiError>({
    queryKey: queryKeys.leave.credits(empId),
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new ApiError("No token found", 401);
      return apiFetch<LeaveCreditDTO[]>(`/leave/credit/${empId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    },
    enabled:
      !!empId &&
      typeof window !== "undefined" &&
      !!localStorage.getItem("auth_token"),
  });
}

export interface LeaveCreditRequestDTO {
  EmlLeacredit?: number;
  EmlUsed?: number;
}

export function useLeaveRequestCredit(empId: string, leaveType: string) {
  return useQuery<LeaveCreditRequestDTO, ApiError>({
    queryKey: ["leave", "credit", "request", empId, leaveType],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new ApiError("No token found", 401);
      return apiFetch<LeaveCreditRequestDTO>(
        `/leave/credit/request/${empId}/${leaveType}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
    },
    enabled:
      !!empId &&
      !!leaveType &&
      typeof window !== "undefined" &&
      !!localStorage.getItem("auth_token"),
    staleTime: 2 * 60 * 1000,
  });
}

export function useCreateLeaveSummary(empId: string) {
  const queryClient = useQueryClient();
  return useMutation<LeaveRequestDTO, ApiError, LeaveRequestDTO>({
    mutationFn: async (data) => {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new ApiError("No token found", 401);
      return apiFetch<LeaveRequestDTO>(`/leave/create/summary/${empId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leave.all });
    },
  });
}

export function useUpdateLeaveSummary(leaveId: string) {
  const queryClient = useQueryClient();
  return useMutation<LeaveRequestDTO, ApiError, LeaveRequestDTO>({
    mutationFn: async (data) => {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new ApiError("No token found", 401);
      return apiFetch<LeaveRequestDTO>(`/leave/edit/summary/${leaveId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leave.all });
    },
  });
}

export function useCancelLeave(leaveId: string) {
  const queryClient = useQueryClient();
  return useMutation<LeaveRequestDTO[], ApiError>({
    mutationFn: async () => {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new ApiError("No token found", 401);
      return apiFetch<LeaveRequestDTO[]>(`/leave/user/delete/${leaveId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leave.all });
    },
  });
}

export interface LeaveGrid {
  LeaSid?: string;
  LeaStype?: string;
  LeaSfrom?: Date | string;
  LeaSto?: Date | string;
  LeaSreason?: string;
  FapReason?: string;
  LeaSwithpay?: number;
  LeaSwithoutpay?: number;
  LeaSapplieddate?: Date | string;
  LeaSstatus?: number;
  LeaSapproveddate?: Date | string | null;
  LeaSapprovedby?: string | null;
  LevDesc?: string | null;
  [key: string]: any;
}

export function useLeaveGrid() {
  return useQuery<LeaveGrid[], ApiError>({
    queryKey: queryKeys.leave.grid(),
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new ApiError("No token found", 401);
      return apiFetch<LeaveGrid[]>("/leave/grid", {
        headers: { Authorization: `Bearer ${token}` },
      });
    },
    staleTime: 2 * 60 * 1000,
    enabled:
      typeof window !== "undefined" && !!localStorage.getItem("auth_token"),
  });
}

export interface ScheduleDayDTO {
  sch_day?: string;
  sch_rest?: number;
  sch_in?: string | null; // HH:mm format from API
  sch_bin?: string | null; // HH:mm format from API
  sch_bout?: string | null; // HH:mm format from API
  sch_out?: string | null; // HH:mm format from API
}

export function useUserLeaveScheduleList() {
  return useQuery<ScheduleDayDTO[], ApiError>({
    queryKey: ["schedule", "list", "user"],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new ApiError("No token found", 401);
      return apiFetch<ScheduleDayDTO[]>("/schedule/list/user", {
        headers: { Authorization: `Bearer ${token}` },
      });
    },
    staleTime: 10 * 60 * 1000,
    enabled:
      typeof window !== "undefined" && !!localStorage.getItem("auth_token"),
  });
}

export interface HolidaySchedDTO {
  hol_id?: number;
  hol_date?: Date | string;
  hol_type?: string | null;
  hol_name?: string | null;
  hol_logdate?: Date | string | null;
  hol_status?: number | null;
  hol_repeat?: number | null;
}

export function useHolidaysForSched() {
  return useQuery<HolidaySchedDTO[], ApiError>({
    queryKey: ["holiday", "list", "forsched"],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new ApiError("No token found", 401);
      return apiFetch<HolidaySchedDTO[]>("/holiday/list/forsched", {
        headers: { Authorization: `Bearer ${token}` },
      });
    },
    staleTime: 10 * 60 * 1000,
    enabled:
      typeof window !== "undefined" && !!localStorage.getItem("auth_token"),
  });
}

export interface SchedAdjustedDate {
  sca_dpk?: string;
  sca_did?: string;
  sca_ddate?: Date | string;
  sca_dshiftstart?: Date | string | null;
  sca_dbreakstart?: Date | string | null;
  sca_dbreakend?: Date | string | null;
  sca_dshiftend?: Date | string | null;
  sca_drest?: number | null;
}

export function useSchedAdjustedDate(dateFrom?: Date, dateTo?: Date) {
  return useQuery<SchedAdjustedDate[], ApiError>({
    queryKey: ["schedadjust", "schedadjusted", dateFrom?.toISOString(), dateTo?.toISOString()],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new ApiError("No token found", 401);
      return apiFetch<SchedAdjustedDate[]>("/schedadjust/schedadjusted", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          date_from: dateFrom?.toISOString(),
          date_to: dateTo?.toISOString(),
        }),
      });
    },
    enabled:
      !!dateFrom &&
      !!dateTo &&
      typeof window !== "undefined" &&
      !!localStorage.getItem("auth_token"),
    staleTime: 5 * 60 * 1000,
  });
}

// ==================== OVERTIME REQUESTS ====================

export interface OvertimeDate {
  OvertimeDate?: Date;
  [key: string]: any;
}

export interface OvertimeRequestDTO {
  otm_id?: string;
  otm_emp?: string;
  otm_type?: number;
  otm_date?: Date | string;
  otm_from?: Date | string;
  otm_to?: Date | string;
  otm_reason?: string;
  otm_status?: number;
  otm_approvedby?: string | null;
  otm_approveddate?: Date | string | null;
  fap_reason?: string | null;
  [key: string]: any;
}

export interface OvertimeAttendanceDTO {
  AttDate?: Date | string;
  AttSchin?: Date | string | null;
  AttSchout?: Date | string | null;
  AttSchbin?: Date | string | null;
  AttSchbout?: Date | string | null;
  AttSchhrs?: string | null;
  AttSchshift?: string | null;
  AttRestday?: string | null;
  AttBioin?: Date | string | null;
  AttBioout?: Date | string | null;
  AttFin?: Date | string | null;
  AttFout?: Date | string | null;
}

export function useOvertimeYear() {
  return useQuery<OvertimeDate[], ApiError>({
    queryKey: queryKeys.overtime.year(),
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new ApiError("No token found", 401);
      return apiFetch<OvertimeDate[]>("/overtime/year", {
        headers: { Authorization: `Bearer ${token}` },
      });
    },
    staleTime: 5 * 60 * 1000,
    enabled:
      typeof window !== "undefined" && !!localStorage.getItem("auth_token"),
  });
}

export function useOvertimeList() {
  return useQuery<OvertimeRequestDTO[], ApiError>({
    queryKey: queryKeys.overtime.list(),
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new ApiError("No token found", 401);
      return apiFetch<OvertimeRequestDTO[]>("/overtime/list", {
        headers: { Authorization: `Bearer ${token}` },
      });
    },
    staleTime: 2 * 60 * 1000,
    enabled:
      typeof window !== "undefined" && !!localStorage.getItem("auth_token"),
  });
}

export function useOvertimeById(userId: string, otId: string) {
  return useQuery<OvertimeRequestDTO[], ApiError>({
    queryKey: queryKeys.overtime.detail(otId),
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new ApiError("No token found", 401);
      return apiFetch<OvertimeRequestDTO[]>(`/overtime/byid/${userId}/${otId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    },
    enabled:
      !!userId &&
      !!otId &&
      typeof window !== "undefined" &&
      !!localStorage.getItem("auth_token"),
  });
}

export function useOvertimeAttendance(date: string) {
  return useQuery<OvertimeAttendanceDTO[], ApiError>({
    queryKey: queryKeys.overtime.attendance(date),
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new ApiError("No token found", 401);
      return apiFetch<OvertimeAttendanceDTO[]>(`/overtime/attendance/${date}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    },
    enabled:
      !!date &&
      typeof window !== "undefined" &&
      !!localStorage.getItem("auth_token"),
  });
}

export function useCreateOvertime() {
  const queryClient = useQueryClient();
  return useMutation<OvertimeRequestDTO, ApiError, OvertimeRequestDTO>({
    mutationFn: async (data) => {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new ApiError("No token found", 401);
      return apiFetch<OvertimeRequestDTO>("/overtime", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.overtime.all });
    },
  });
}

export function useUpdateOvertime(otId: string) {
  const queryClient = useQueryClient();
  return useMutation<OvertimeRequestDTO, ApiError, OvertimeRequestDTO>({
    mutationFn: async (data) => {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new ApiError("No token found", 401);
      return apiFetch<OvertimeRequestDTO>(`/overtime/${otId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.overtime.all });
    },
  });
}

export function useCancelOvertime(otId: string) {
  const queryClient = useQueryClient();
  return useMutation<OvertimeRequestDTO[], ApiError>({
    mutationFn: async () => {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new ApiError("No token found", 401);
      return apiFetch<OvertimeRequestDTO[]>(`/overtime/cancel/${otId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.overtime.all });
    },
  });
}

// ==================== UNDERTIME REQUESTS ====================

export interface UndertimeRequestDTO {
  UtmId?: string;
  UtmEmp?: string;
  UtmDate?: Date | string;
  UtmFrom?: Date | string;
  UtmTo?: Date | string;
  UtmReason?: string;
  UtmApplieddate?: Date | string;
  UtmStatus?: number;
  UtmApprovedby?: string | null;
  UtmApproveddate?: Date | string | null;
  fap_reason?: string | null;
  [key: string]: any;
}

export function useUndertimeList() {
  return useQuery<UndertimeRequestDTO[], ApiError>({
    queryKey: queryKeys.undertime.list(),
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new ApiError("No token found", 401);
      return apiFetch<UndertimeRequestDTO[]>("/undertime/list", {
        headers: { Authorization: `Bearer ${token}` },
      });
    },
    staleTime: 2 * 60 * 1000,
    enabled:
      typeof window !== "undefined" && !!localStorage.getItem("auth_token"),
  });
}

export function useUndertimeById(id: string) {
  return useQuery<UndertimeRequestDTO, ApiError>({
    queryKey: queryKeys.undertime.detail(id),
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new ApiError("No token found", 401);
      return apiFetch<UndertimeRequestDTO>(`/undertime/id/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    },
    enabled:
      !!id &&
      typeof window !== "undefined" &&
      !!localStorage.getItem("auth_token"),
  });
}

export function useCreateUndertime(empId: string) {
  const queryClient = useQueryClient();
  return useMutation<UndertimeRequestDTO, ApiError, UndertimeRequestDTO>({
    mutationFn: async (data) => {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new ApiError("No token found", 401);
      return apiFetch<UndertimeRequestDTO>(`/undertime/create/${empId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.undertime.all });
    },
  });
}

export function useUpdateUndertime(utId: string) {
  const queryClient = useQueryClient();
  return useMutation<UndertimeRequestDTO, ApiError, UndertimeRequestDTO>({
    mutationFn: async (data) => {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new ApiError("No token found", 401);
      return apiFetch<UndertimeRequestDTO>(`/undertime/edit/${utId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.undertime.all });
    },
  });
}

export function useCancelUndertime(utId: string) {
  const queryClient = useQueryClient();
  return useMutation<UndertimeRequestDTO[], ApiError>({
    mutationFn: async () => {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new ApiError("No token found", 401);
      return apiFetch<UndertimeRequestDTO[]>(`/undertime/cancel/${utId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.undertime.all });
    },
  });
}

// ==================== SCHEDULE ADJUSTMENT REQUESTS ====================

export interface SchedAdjustedDate {
  SchedAdjustedDate?: Date;
  [key: string]: any;
}

export interface SchedAdjustRequestDTO {
  ScaSid?: string;
  ScaSemp?: string;
  ScaSdatefrom?: Date | string;
  ScaSdateto?: Date | string;
  ScaSreason?: string;
  ScaSapplieddate?: Date | string;
  ScaSstatus?: number;
  ScaSapprovedby?: string | null;
  ScaSapproveddate?: Date | string | null;
  FapReason?: string | null;
  SchedDetail?: SchedAdjustDetailDTO[];
  [key: string]: any;
}

export interface SchedAdjustDetailDTO {
  ScaDdate?: Date | string;
  ScaDshiftstart?: Date | string;
  ScaDbreakstart?: Date | string;
  ScaDbreakend?: Date | string;
  ScaDshiftend?: Date | string;
  ScaDrest?: number;
  ScaDbreak?: number;
  ScaDShift?: number;
  [key: string]: any;
}

export function useScheduleAdjustList() {
  return useQuery<SchedAdjustRequestDTO[], ApiError>({
    queryKey: queryKeys.scheduleAdjust.list(),
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new ApiError("No token found", 401);
      return apiFetch<SchedAdjustRequestDTO[]>("/schedule-adjust/list", {
        headers: { Authorization: `Bearer ${token}` },
      });
    },
    staleTime: 2 * 60 * 1000,
    enabled:
      typeof window !== "undefined" && !!localStorage.getItem("auth_token"),
  });
}

export function useScheduleAdjustYear() {
  return useQuery<SchedAdjustedDate[], ApiError>({
    queryKey: queryKeys.scheduleAdjust.year(),
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new ApiError("No token found", 401);
      return apiFetch<SchedAdjustedDate[]>("/schedule-adjust/year", {
        headers: { Authorization: `Bearer ${token}` },
      });
    },
    staleTime: 5 * 60 * 1000,
    enabled:
      typeof window !== "undefined" && !!localStorage.getItem("auth_token"),
  });
}

export function useScheduleAdjustById(id: string) {
  return useQuery<SchedAdjustRequestDTO, ApiError>({
    queryKey: queryKeys.scheduleAdjust.detail(id),
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new ApiError("No token found", 401);
      return apiFetch<SchedAdjustRequestDTO>(`/schedule-adjust/id/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    },
    enabled:
      !!id &&
      typeof window !== "undefined" &&
      !!localStorage.getItem("auth_token"),
  });
}

export function useCreateScheduleAdjust() {
  const queryClient = useQueryClient();
  return useMutation<SchedAdjustRequestDTO, ApiError, SchedAdjustRequestDTO>({
    mutationFn: async (data) => {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new ApiError("No token found", 401);
      return apiFetch<SchedAdjustRequestDTO>("/schedule-adjust/create", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.scheduleAdjust.all });
    },
  });
}

export function useUpdateScheduleAdjust(scaId: string) {
  const queryClient = useQueryClient();
  return useMutation<SchedAdjustRequestDTO, ApiError, SchedAdjustRequestDTO>({
    mutationFn: async (data) => {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new ApiError("No token found", 401);
      return apiFetch<SchedAdjustRequestDTO>(`/schedule-adjust/edit/${scaId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.scheduleAdjust.all });
    },
  });
}

export function useCancelScheduleAdjust(scaId: string) {
  const queryClient = useQueryClient();
  return useMutation<SchedAdjustRequestDTO[], ApiError>({
    mutationFn: async () => {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new ApiError("No token found", 401);
      return apiFetch<SchedAdjustRequestDTO[]>(`/schedule-adjust/cancel/${scaId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.scheduleAdjust.all });
    },
  });
}

// ==================== COA (Change of Attendance) REQUESTS ====================

/** COA type from API (Prisma coa_type: snake_case) */
export interface CoaType {
  coa_tid: string;
  coa_tdesc?: string | null;
  coa_ttag?: number | null;
}

export interface CoaForm {
  CoaStype?: string;
  CoaStypedetail?: string;
  CoaSreason?: string;
  CoaSemp?: string;
  CoaDetails?: CoaDetailDTO[];
}

export interface CoaDetailDTO {
  CoaDtype?: string;
  CoaDdate?: Date | string;
  CoaDtime?: Date | string;
}

export function useCoaTypes() {
  return useQuery<CoaType[], ApiError>({
    queryKey: queryKeys.coa.types(),
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new ApiError("No token found", 401);
      return apiFetch<CoaType[]>("/coa/coatype", {
        headers: { Authorization: `Bearer ${token}` },
      });
    },
    staleTime: 10 * 60 * 1000,
    enabled:
      typeof window !== "undefined" && !!localStorage.getItem("auth_token"),
  });
}

export function useCoaById(coaSid: string) {
  return useQuery<CoaForm, ApiError>({
    queryKey: queryKeys.coa.detail(coaSid),
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new ApiError("No token found", 401);
      return apiFetch<CoaForm>(`/coa/${coaSid}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    },
    enabled:
      !!coaSid &&
      typeof window !== "undefined" &&
      !!localStorage.getItem("auth_token"),
  });
}

export function useCreateCOA() {
  const queryClient = useQueryClient();
  return useMutation<CoaForm, ApiError, CoaForm>({
    mutationFn: async (data) => {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new ApiError("No token found", 401);
      return apiFetch<CoaForm>("/coa", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.coa.all });
    },
  });
}

export function useUpdateCOA(coaSid: string) {
  const queryClient = useQueryClient();
  return useMutation<CoaForm, ApiError, CoaForm>({
    mutationFn: async (data) => {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new ApiError("No token found", 401);
      return apiFetch<CoaForm>(`/coa/${coaSid}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.coa.all });
    },
  });
}

export interface CoaGrid {
  coa_sid?: string;
  coa_stype?: string;
  coa_stypedetail?: string;
  coa_sreason?: string;
  FapReason?: string | null;
  coa_semp?: string;
  coa_sapplieddate?: Date | string;
  coa_sstatus?: number;
  coa_sapprovedby?: string | null;
  coa_sapproveddate?: Date | string | null;
}

export function useCoaGrid() {
  return useQuery<CoaGrid[], ApiError>({
    queryKey: queryKeys.coa.grid(),
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new ApiError("No token found", 401);
      return apiFetch<CoaGrid[]>("/coa/grid", {
        headers: { Authorization: `Bearer ${token}` },
      });
    },
    staleTime: 2 * 60 * 1000,
    enabled:
      typeof window !== "undefined" && !!localStorage.getItem("auth_token"),
  });
}

// ==================== LOAN REQUESTS ====================

export interface LoanDTO {
  LoaId?: string;
  LoaEmp?: string;
  EmpName?: string | null;
  LoaAmt?: number;
  LoaReason?: string;
  LoaType?: string;
  LoaExprelease?: Date | string | null;
  FapReason?: string | null;
  LoaApplieddate?: Date | string;
  LoaStatus?: number;
  LoaApprovedby?: string | null;
  LoaApproveddate?: Date | string | null;
  [key: string]: any;
}

export interface LoanGridManagement {
  LoaId?: string;
  LoaEmp?: string;
  LoaAmt?: number;
  LoaReason?: string;
  LoaType?: string;
  LoaStatus?: number;
  [key: string]: any;
}

export interface LoanManagementDTO {
  LoaId?: string;
  Status?: number;
  Reason?: string | null;
  LoaEmp?: string;
  EmpAdtype?: string;
  EmpAddate?: Date | string;
  EmpAdamt?: number;
  EmpAdaddedamt?: number;
  EmpAdpaypermonth?: number;
  EmpAdpaycutoff?: number | null;
  EmpAdstart?: Date | string;
  EmpAdamtperpay?: number;
  [key: string]: any;
}

export function useLoanManagementList() {
  return useQuery<LoanGridManagement[], ApiError>({
    queryKey: queryKeys.loan.managementList(),
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new ApiError("No token found", 401);
      return apiFetch<LoanGridManagement[]>("/loan", {
        headers: { Authorization: `Bearer ${token}` },
      });
    },
    staleTime: 2 * 60 * 1000,
    enabled:
      typeof window !== "undefined" && !!localStorage.getItem("auth_token"),
  });
}

export function useLoanList() {
  return useQuery<LoanDTO[], ApiError>({
    queryKey: queryKeys.loan.list(),
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new ApiError("No token found", 401);
      return apiFetch<LoanDTO[]>("/loan", {
        headers: { Authorization: `Bearer ${token}` },
      });
    },
    staleTime: 2 * 60 * 1000,
    enabled:
      typeof window !== "undefined" && !!localStorage.getItem("auth_token"),
  });
}

export function useLoanById(id: string) {
  return useQuery<LoanDTO, ApiError>({
    queryKey: queryKeys.loan.detail(id),
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new ApiError("No token found", 401);
      return apiFetch<LoanDTO>(`/loan/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    },
    enabled:
      !!id &&
      typeof window !== "undefined" &&
      !!localStorage.getItem("auth_token"),
  });
}

export function useCreateLoan() {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, LoanDTO>({
    mutationFn: async (data) => {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new ApiError("No token found", 401);
      return apiFetch<void>("/loan", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.loan.all });
    },
  });
}

export function useUpdateLoan(loanId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, LoanDTO>({
    mutationFn: async (data) => {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new ApiError("No token found", 401);
      return apiFetch<void>(`/loan/${loanId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.loan.all });
    },
  });
}

export function useManageLoan() {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, LoanManagementDTO>({
    mutationFn: async (data) => {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new ApiError("No token found", 401);
      return apiFetch<void>("/loan/manage", {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.loan.all });
    },
  });
}

export function useCancelLoan(loanId: string) {
  const queryClient = useQueryClient();
  return useMutation<LoanDTO[], ApiError>({
    mutationFn: async () => {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new ApiError("No token found", 401);
      return apiFetch<LoanDTO[]>(`/loan/cancel/${loanId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.loan.all });
    },
  });
}
