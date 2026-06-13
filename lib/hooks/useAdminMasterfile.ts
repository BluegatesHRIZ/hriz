"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, apiFetch } from "@/lib/api/client";

function authHeader(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
  if (!token) throw new ApiError("No token found", 401);
  return { Authorization: `Bearer ${token}` };
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DepartmentDTO {
  dep_id: string;
  dep_desc: string | null;
  dep_status: number | null;
}

export interface LocationDTO {
  loc_id: string;
  loc_desc: string | null;
  loc_code: string | null;
  loc_status: number | null;
}

export interface PositionDTO {
  pst_id: string;
  pst_desc: string | null;
  pst_Status: number | null;
}

export interface LeaveTypeDTO {
  lev_id: string;
  lev_desc: string | null;
  lev_days: number | null;
  lev_status: number | null;
  lev_before: number | null;
  lev_lead: number | null;
  lev_after: number | null;
}

// ─── Departments ──────────────────────────────────────────────────────────────

export function useAdminDepartments() {
  return useQuery<DepartmentDTO[], ApiError>({
    queryKey: ["admin", "masterfile", "departments"],
    queryFn: () =>
      apiFetch<DepartmentDTO[]>("/admin/masterfile/departments", { headers: authHeader() }),
  });
}

export function useCreateDepartment() {
  const qc = useQueryClient();
  return useMutation<DepartmentDTO, ApiError, { dep_id: string; dep_desc: string; dep_status: number }>({
    mutationFn: (data) =>
      apiFetch<DepartmentDTO>("/admin/masterfile/departments", {
        method: "POST",
        headers: { ...authHeader(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "masterfile", "departments"] }),
  });
}

export function useUpdateDepartment() {
  const qc = useQueryClient();
  return useMutation<DepartmentDTO, ApiError, { dep_id: string; dep_desc: string; dep_status: number }>({
    mutationFn: ({ dep_id, ...data }) =>
      apiFetch<DepartmentDTO>(`/admin/masterfile/departments/${dep_id}`, {
        method: "PUT",
        headers: { ...authHeader(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "masterfile", "departments"] }),
  });
}

export function useDeleteDepartment() {
  const qc = useQueryClient();
  return useMutation<{ message: string }, ApiError, string>({
    mutationFn: (id) =>
      apiFetch<{ message: string }>(`/admin/masterfile/departments/${id}`, {
        method: "DELETE",
        headers: authHeader(),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "masterfile", "departments"] }),
  });
}

// ─── Locations ────────────────────────────────────────────────────────────────

export function useAdminLocations() {
  return useQuery<LocationDTO[], ApiError>({
    queryKey: ["admin", "masterfile", "locations"],
    queryFn: () =>
      apiFetch<LocationDTO[]>("/admin/masterfile/locations", { headers: authHeader() }),
  });
}

export function useCreateLocation() {
  const qc = useQueryClient();
  return useMutation<LocationDTO, ApiError, { loc_id: string; loc_desc: string; loc_code: string; loc_status: number }>({
    mutationFn: (data) =>
      apiFetch<LocationDTO>("/admin/masterfile/locations", {
        method: "POST",
        headers: { ...authHeader(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "masterfile", "locations"] }),
  });
}

export function useUpdateLocation() {
  const qc = useQueryClient();
  return useMutation<LocationDTO, ApiError, { loc_id: string; loc_desc: string; loc_code: string; loc_status: number }>({
    mutationFn: ({ loc_id, ...data }) =>
      apiFetch<LocationDTO>(`/admin/masterfile/locations/${loc_id}`, {
        method: "PUT",
        headers: { ...authHeader(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "masterfile", "locations"] }),
  });
}

export function useDeleteLocation() {
  const qc = useQueryClient();
  return useMutation<{ message: string }, ApiError, string>({
    mutationFn: (id) =>
      apiFetch<{ message: string }>(`/admin/masterfile/locations/${id}`, {
        method: "DELETE",
        headers: authHeader(),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "masterfile", "locations"] }),
  });
}

// ─── Positions ────────────────────────────────────────────────────────────────

export function useAdminPositions() {
  return useQuery<PositionDTO[], ApiError>({
    queryKey: ["admin", "masterfile", "positions"],
    queryFn: () =>
      apiFetch<PositionDTO[]>("/admin/masterfile/positions", { headers: authHeader() }),
  });
}

export function useCreatePosition() {
  const qc = useQueryClient();
  return useMutation<PositionDTO, ApiError, { pst_id: string; pst_desc: string; pst_Status: number }>({
    mutationFn: (data) =>
      apiFetch<PositionDTO>("/admin/masterfile/positions", {
        method: "POST",
        headers: { ...authHeader(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "masterfile", "positions"] }),
  });
}

export function useUpdatePosition() {
  const qc = useQueryClient();
  return useMutation<PositionDTO, ApiError, { pst_id: string; pst_desc: string; pst_Status: number }>({
    mutationFn: ({ pst_id, ...data }) =>
      apiFetch<PositionDTO>(`/admin/masterfile/positions/${pst_id}`, {
        method: "PUT",
        headers: { ...authHeader(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "masterfile", "positions"] }),
  });
}

export function useDeletePosition() {
  const qc = useQueryClient();
  return useMutation<{ message: string }, ApiError, string>({
    mutationFn: (id) =>
      apiFetch<{ message: string }>(`/admin/masterfile/positions/${id}`, {
        method: "DELETE",
        headers: authHeader(),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "masterfile", "positions"] }),
  });
}

// ─── Leave Types ──────────────────────────────────────────────────────────────

export function useAdminLeaveTypes() {
  return useQuery<LeaveTypeDTO[], ApiError>({
    queryKey: ["admin", "masterfile", "leave-types"],
    queryFn: () =>
      apiFetch<LeaveTypeDTO[]>("/admin/masterfile/leave-types", { headers: authHeader() }),
  });
}

export function useCreateLeaveType() {
  const qc = useQueryClient();
  return useMutation<LeaveTypeDTO, ApiError, Omit<LeaveTypeDTO, "lev_datecreated" | "lev_createdby">>({
    mutationFn: (data) =>
      apiFetch<LeaveTypeDTO>("/admin/masterfile/leave-types", {
        method: "POST",
        headers: { ...authHeader(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "masterfile", "leave-types"] }),
  });
}

export function useUpdateLeaveType() {
  const qc = useQueryClient();
  return useMutation<LeaveTypeDTO, ApiError, LeaveTypeDTO>({
    mutationFn: ({ lev_id, ...data }) =>
      apiFetch<LeaveTypeDTO>(`/admin/masterfile/leave-types/${lev_id}`, {
        method: "PUT",
        headers: { ...authHeader(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "masterfile", "leave-types"] }),
  });
}

export function useDeleteLeaveType() {
  const qc = useQueryClient();
  return useMutation<{ message: string }, ApiError, string>({
    mutationFn: (id) =>
      apiFetch<{ message: string }>(`/admin/masterfile/leave-types/${id}`, {
        method: "DELETE",
        headers: authHeader(),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "masterfile", "leave-types"] }),
  });
}
