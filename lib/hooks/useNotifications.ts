"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, ApiError } from "@/lib/api/client";

export interface NotificationDTO {
  not_id: number;
  not_emp: string;
  not_title: string;
  not_desc: string;
  not_status: number;
  not_createdby: string;
  not_logdate: string;
}

function token() {
  return typeof window !== "undefined" ? localStorage.getItem("auth_token") ?? "" : "";
}

export function useNotifications() {
  return useQuery<NotificationDTO[], ApiError>({
    queryKey: ["notifications"],
    queryFn: () =>
      apiFetch<NotificationDTO[]>("/notifications", {
        headers: { Authorization: `Bearer ${token()}` },
      }),
    refetchInterval: 30_000,
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation<void, ApiError, number>({
    mutationFn: (id) =>
      apiFetch<void>(`/notifications/${id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token()}` },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation<void, ApiError, void>({
    mutationFn: () =>
      apiFetch<void>("/notifications/read-all", {
        method: "PUT",
        headers: { Authorization: `Bearer ${token()}` },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useDeleteNotification() {
  const qc = useQueryClient();
  return useMutation<void, ApiError, number>({
    mutationFn: (id) =>
      apiFetch<void>(`/notifications/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token()}` },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}
