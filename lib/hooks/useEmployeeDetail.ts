"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, ApiError } from "@/lib/api/client";

export interface EmployeeDetail {
  Account: {
    EmpId: string;
    EmpLast: string | null;
    EmpFirst: string | null;
    EmpMid: string | null;
    EmpDept: string | null;
    EmpPos: string | null;
    EmpLoc: string | null;
    EmpRole: string | null;
    EmpExternalId: string | null;
    EmpDatecreated: Date | null;
  };
  Personal: {
    EmpAddress: string | null;
    EmpBirthday: Date | null;
    EmpMother: string | null;
    EmpFather: string | null;
    EmpGender: string | null;
    EmpCivil: string | null;
    EmpSpouse: string | null;
    EmpAccount: string | null;
    EmpContact1: string | null;
    EmpContact2: string | null;
    EmpEmail: string | null;
  } | null;
  EmpWrk: {
    emp_code: string | null;
    emp_type: number | null;
    emp_datehired: Date | null;
    emp_dateexp: Date | null;
    emp_datereg: Date | null;
    emp_supervisor: string | null;
    emp_remarks: string | null;
    emp_sss: string | null;
    emp_philhealth: string | null;
    emp_pagibig: string | null;
    emp_tin: string | null;
    emp_taxstat: string | null;
    emp_rdo: string | null;
    emp_passport: string | null;
    emp_prc: string | null;
    // Legacy fields for backward compatibility
    emp_hiredate: Date | null;
    emp_enddate: Date | null;
    emp_regular: number | null;
    emp_contract: number | null;
    emp_probationary: number | null;
    emp_status: number | null;
  } | null;
  EmpDependent: Array<{
    DepId: number;
    DepName: string | null;
    DepRelation: string | null;
    DepBirthday: Date | null;
    DepContact: string | null;
  }>;
  EmpHistory: Array<{
    HisId: number;
    HisCompany: string | null;
    HisPosition: string | null;
    HisStartdate: Date | null;
    HisEnddate: Date | null;
    HisRemarks: string | null;
  }>;
  EmpBenefit: Array<{
    BenId: number;
    BenType: string | null;
    BenNumber: string | null;
    BenDate: Date | null;
    BenRemarks: string | null;
    // Additional fields for form
    EmbBcode?: string | null;
    EmbDesc?: string | null;
    EmbAmt?: number | null;
  }>;
  EmpMed: Array<{
    MedId: number;
    MedType: string | null;
    MedDate: Date | null;
    MedRemarks: string | null;
    MedFile: string | null;
  }>;
  EmpLeave: Array<{
    LevId: number;
    LevType: string | null;
    LevCredits: number | null;
    LevUsed: number | null;
    LevRemaining: number | null;
    LevTypeDesc: string;
  }>;
  EmpSalary: Array<{
    SalId: number;
    SalAmount: number | null;
    SalDate: Date | null;
    SalPosition: string | null;
    SalPayrollType?: string | null;
    SalDateFrom?: Date | null;
    SalDateTo?: Date | null;
    SalRemarks: string | null;
    SalStatus?: number | null;
  }>;
  EmpAdvance: Array<{
    AdvId: number;
    AdvType: string | null;
    AdvAmount: number | null;
    AdvDate: Date | null;
    AdvRemarks: string | null;
  }>;
  Schedule: Array<{
    SchedId: number;
    SchedDay: string | null;
    SchedTimein: string | null;
    SchedTimeout: string | null;
    SchedBreakin: string | null;
    SchedBreakout: string | null;
    SchedShift?: string | null;
    SchedRemarks: string | null;
  }>;
  Approval: Array<{
    AlId: number;
    AlLevel: number;
    AlModule: string | null;
    AlApprv: string | null;
    AlStatus: number | null;
    AlRemarks: string | null;
  }>;
  files: {
    profile: {
      fil_id: string;
      fil_path: string;
      fil_name: string;
      fil_url: string | null;
    } | null;
  };
}

/** Empty employee shape for "Add new employee" (id === "new") */
export const EMPTY_EMPLOYEE_DETAIL: EmployeeDetail = {
  Account: {
    EmpId: "",
    EmpLast: null,
    EmpFirst: null,
    EmpMid: null,
    EmpDept: null,
    EmpPos: null,
    EmpLoc: null,
    EmpRole: null,
    EmpExternalId: null,
    EmpDatecreated: null,
  },
  Personal: null,
  EmpWrk: null,
  EmpDependent: [],
  EmpHistory: [],
  EmpBenefit: [],
  EmpMed: [],
  EmpLeave: [],
  EmpSalary: [],
  EmpAdvance: [],
  Schedule: [],
  Approval: [],
  files: { profile: null },
};

export interface Department {
  dep_id: string;
  dep_desc: string | null;
}

export interface Position {
  pst_id: string;
  pst_desc: string | null;
}

export interface Location {
  loc_id: string;
  loc_desc: string | null;
}

/**
 * Hook for fetching employee details by ID
 */
export function useEmployeeDetail(
  empId: string | null,
  enabled: boolean = true
) {
  return useQuery<EmployeeDetail, ApiError>({
    queryKey: ["employee", "detail", empId],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new ApiError("No token found", 401);

      return apiFetch<EmployeeDetail>(`/employee/${empId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    },
    enabled: enabled && !!empId,
  });
}

/**
 * Hook for fetching departments
 */
export function useDepartments() {
  return useQuery<Department[], ApiError>({
    queryKey: ["employee", "departments"],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new ApiError("No token found", 401);

      return apiFetch<Department[]>("/employee/departments", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    },
  });
}

/**
 * Hook for fetching positions
 */
export function usePositions() {
  return useQuery<Position[], ApiError>({
    queryKey: ["employee", "positions"],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new ApiError("No token found", 401);

      return apiFetch<Position[]>("/employee/positions", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    },
  });
}

/**
 * Hook for fetching locations
 */
export function useLocations() {
  return useQuery<Location[], ApiError>({
    queryKey: ["employee", "locations"],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new ApiError("No token found", 401);

      return apiFetch<Location[]>("/employee/locations", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    },
  });
}

/**
 * Hook for fetching roles
 */
export function useRoles() {
  return useQuery<
    Array<{ rol_id: string; rol_name: string | null; rol_desc: string | null }>,
    ApiError
  >({
    queryKey: ["roles"],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new ApiError("No token found", 401);

      return apiFetch<
        Array<{ rol_id: string; rol_name: string | null; rol_desc: string | null }>
      >("/roles", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    },
  });
}

export interface UpdateAccountData {
  Account: {
    EmpLast: string;
    EmpFirst: string;
    EmpMid?: string | null;
    EmpDept: string | null;
    EmpPos: string | null;
    EmpLoc: string | null;
    EmpRole?: string | null;
    EmpExternalId?: string | null;
  };
  Personal?: {
    EmpAddress?: string | null;
    EmpBirthday?: Date | null;
    EmpMother?: string | null;
    EmpFather?: string | null;
    EmpGender?: string | null;
    EmpCivil?: string | null;
    EmpSpouse?: string | null;
    EmpContact1?: string | null;
    EmpContact2?: string | null;
    EmpEmail?: string | null;
    EmpAccount?: string | null;
  } | null;
}

export interface CreateEmployeeAccountPayload {
  Account: {
    EmpLast: string;
    EmpFirst: string;
    EmpMid?: string | null;
    EmpDept: string;
    EmpPos: string;
    EmpLoc: string;
    EmpRole?: string | null;
    EmpExternalId?: string | null;
    EmpPswd?: string | null;
  };
  Personal?: {
    EmpAddress?: string | null;
    EmpBirthday?: Date | null;
    EmpMother?: string | null;
    EmpFather?: string | null;
    EmpGender?: string | null;
    EmpCivil?: string | null;
    EmpSpouse?: string | null;
    EmpContact1?: string | null;
    EmpContact2?: string | null;
    EmpEmail?: string | null;
    EmpAccount?: string | null;
  } | null;
}

export interface CreatedEmployeeAccountResponse {
  emp_id: string;
  emp_first: string | null;
  emp_last: string | null;
  emp_mid: string | null;
  emp_dept: string | null;
  emp_pos: string | null;
  emp_loc: string | null;
  emp_role: string | null;
  emp_extid: string | null;
}

/**
 * Hook for updating employee account information
 */
export function useUpdateEmployeeAccount(empId: string) {
  const queryClient = useQueryClient();

  return useMutation<void, ApiError, UpdateAccountData>({
    mutationFn: async (data) => {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new ApiError("No token found", 401);

      return apiFetch<void>(`/employee/${empId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      // Invalidate employee detail query to refetch updated data
      queryClient.invalidateQueries({
        queryKey: ["employee", "detail", empId],
      });
      queryClient.invalidateQueries({ queryKey: ["employees", "list"] });
    },
  });
}

/**
 * Hook for creating a new employee account (employee + optional personal).
 */
export function useCreateEmployeeAccount() {
  const queryClient = useQueryClient();

  return useMutation<
    CreatedEmployeeAccountResponse,
    ApiError,
    CreateEmployeeAccountPayload
  >({
    mutationFn: async (payload) => {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new ApiError("No token found", 401);

      return apiFetch<CreatedEmployeeAccountResponse>("/employee", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (data) => {
      // New employee created – refresh employee list; detail for new ID will be fetched on navigation.
      queryClient.invalidateQueries({ queryKey: ["employees", "list"] });
      queryClient.invalidateQueries({
        queryKey: ["employee", "detail", data.emp_id],
      });
    },
  });
}

export interface ScheduleDay {
  sch_day: string;
  sch_in: string;
  sch_out: string;
  sch_bin: string;
  sch_bout: string;
  sch_hrs: number;
  sch_rest: boolean;
  sch_shift: string;
  have_break: boolean;
}

/**
 * Hook for fetching employee schedule
 */
export function useEmployeeSchedule(
  empId: string | null,
  enabled: boolean = true
) {
  return useQuery<ScheduleDay[], ApiError>({
    queryKey: ["employee", "schedule", empId],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new ApiError("No token found", 401);

      const result = await apiFetch<ScheduleDay[]>(
        `/employee/${empId}/schedule`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      // Transform API response to match ScheduleDay format
      return result.map((s: any) => ({
        sch_day: s.SchedDay || "",
        sch_in: s.SchedTimein || "09:00",
        sch_out: s.SchedTimeout || "18:00",
        sch_bin: s.SchedBreakin || "12:00",
        sch_bout: s.SchedBreakout || "13:00",
        sch_hrs: s.SchedHours || 8,
        sch_rest: s.SchedRest || false,
        sch_shift: s.SchedShift || "R",
        have_break: s.HaveBreak || false,
      }));
    },
    enabled: enabled && !!empId,
  });
}

/**
 * Hook for saving employee schedule
 */
export function useSaveEmployeeSchedule(empId: string) {
  const queryClient = useQueryClient();

  return useMutation<void, ApiError, ScheduleDay[]>({
    mutationFn: async (schedules) => {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new ApiError("No token found", 401);

      return apiFetch<void>(`/employee/${empId}/schedule`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(schedules),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["employee", "schedule", empId],
      });
      queryClient.invalidateQueries({
        queryKey: ["employee", "detail", empId],
      });
    },
  });
}

export interface SaveBenefitsAndLeavesData {
  leaves: Array<{
    EmlLeave: string;
    EmlLeacredit: number;
  }>;
  benefits: Array<{
    EmbBcode: string;
    EmbDesc: string;
    EmbAmt: number;
  }>;
}

/**
 * Hook for saving employee benefits and leaves
 */
export function useSaveBenefitsAndLeaves(empId: string) {
  const queryClient = useQueryClient();

  return useMutation<void, ApiError, SaveBenefitsAndLeavesData>({
    mutationFn: async (data) => {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new ApiError("No token found", 401);

      return apiFetch<void>(`/employee/${empId}/benefits-leaves`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["employee", "detail", empId],
      });
    },
  });
}

export interface SaveWorkInformationData {
  emp_code?: string | null;
  emp_type: number;
  emp_datehired?: Date | null;
  emp_dateexp?: Date | null;
  emp_datereg?: Date | null;
  emp_supervisor?: string | null;
  emp_remarks?: string | null;
  emp_sss?: string | null;
  emp_philhealth?: string | null;
  emp_pagibig?: string | null;
  emp_tin?: string | null;
  emp_taxstat?: string | null;
  emp_rdo?: string | null;
  emp_passport?: string | null;
  emp_prc?: string | null;
  approvalLevels?: Array<{
    AlLevel: number;
    AlApprv: string;
    AlModule?: string | null;
  }>;
}

/**
 * Hook for saving employee work information
 */
export function useSaveWorkInformation(empId: string) {
  const queryClient = useQueryClient();

  return useMutation<void, ApiError, SaveWorkInformationData>({
    mutationFn: async (data) => {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new ApiError("No token found", 401);

      return apiFetch<void>(`/employee/${empId}/work`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["employee", "detail", empId],
      });
    },
  });
}

export interface SalaryHistoryData {
  SalId: number;
  SalPosition: string;
  SalPayrollType: string;
  SalDateFrom: Date | null;
  SalDateTo: Date | null;
  SalAmount: number;
  SalRemarks: string;
  SalStatus: number;
}

/**
 * Hook for saving employee salary history
 */
export function useSaveSalaryHistory(empId: string) {
  const queryClient = useQueryClient();

  return useMutation<void, ApiError, { salaries: SalaryHistoryData[] }>({
    mutationFn: async (data) => {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new ApiError("No token found", 401);

      return apiFetch<void>(`/employee/${empId}/salary`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["employee", "detail", empId],
      });
    },
  });
}

export interface AdvanceData {
  AdvId: number;
  AdvType: string;
  AdvDate: Date | null;
  AdvAmount: number;
  AddedAmount: number;
  PayPerMonth: number;
  StartDate: Date | null;
  EndDate: Date | null;
  AmountPerPay: number;
  PayCutoff: number | null;
}

/**
 * Hook for saving employee advances and loans
 */
export function useSaveAdvances(empId: string) {
  const queryClient = useQueryClient();

  return useMutation<void, ApiError, { advances: AdvanceData[] }>({
    mutationFn: async (data) => {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new ApiError("No token found", 401);

      return apiFetch<void>(`/employee/${empId}/advances`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["employee", "detail", empId],
      });
    },
  });
}

export interface ChangePasswordData {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
}

/**
 * Hook for changing employee password
 */
export function useChangePassword(empId: string) {
  const queryClient = useQueryClient();

  return useMutation<void, ApiError, ChangePasswordData>({
    mutationFn: async (data) => {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new ApiError("No token found", 401);

      return apiFetch<void>(`/employee/${empId}/security`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["employee", "detail", empId],
      });
    },
  });
}
