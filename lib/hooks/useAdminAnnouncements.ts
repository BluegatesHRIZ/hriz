"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, apiFetch } from "@/lib/api/client";

function authHeader(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
  if (!token) throw new ApiError("No token found", 401);
  return { Authorization: `Bearer ${token}` };
}

export interface AnnouncementDTO {
  an_id: number;
  an_headline: string | null;
  an_message: string | null;
  an_type: string | null;
  an_startdate: string | null;
  an_enddate: string | null;
  an_repeat: number | null;
  an_status: number | null;
  an_by: string | null;
  an_logdate: string | null;
  an_modified: string | null;
}

export interface AnnouncementFormData {
  an_headline: string;
  an_message: string;
  an_type: string;
  an_startdate: string;
  an_enddate: string;
  an_repeat: number;
  an_status: number;
}

const QK = ["admin", "announcements"] as const;

export function useAdminAnnouncements() {
  return useQuery<AnnouncementDTO[], ApiError>({
    queryKey: [...QK],
    queryFn: () =>
      apiFetch<AnnouncementDTO[]>("/admin/announcements", { headers: authHeader() }),
  });
}

export function useCreateAnnouncement() {
  const qc = useQueryClient();
  return useMutation<AnnouncementDTO, ApiError, AnnouncementFormData>({
    mutationFn: (data) =>
      apiFetch<AnnouncementDTO>("/admin/announcements", {
        method: "POST",
        headers: { ...authHeader(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...QK] });
      qc.invalidateQueries({ queryKey: ["news"] });
    },
  });
}

export function useUpdateAnnouncement() {
  const qc = useQueryClient();
  return useMutation<AnnouncementDTO, ApiError, { id: number } & AnnouncementFormData>({
    mutationFn: ({ id, ...data }) =>
      apiFetch<AnnouncementDTO>(`/admin/announcements/${id}`, {
        method: "PUT",
        headers: { ...authHeader(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...QK] });
      qc.invalidateQueries({ queryKey: ["news"] });
    },
  });
}

export function useDeleteAnnouncement() {
  const qc = useQueryClient();
  return useMutation<{ message: string }, ApiError, number>({
    mutationFn: (id) =>
      apiFetch<{ message: string }>(`/admin/announcements/${id}`, {
        method: "DELETE",
        headers: authHeader(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...QK] });
      qc.invalidateQueries({ queryKey: ["news"] });
    },
  });
}
