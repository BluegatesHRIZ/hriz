import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, ApiError } from "@/lib/api/client";
import { queryKeys } from "@/lib/hooks/queries";
import type { ScheduleDayValue } from "@/components/schedules/scheduleDays";

export interface ScheduleTemplateSummary {
  id: string;
  name: string;
  description: string | null;
  createdBy: string | null;
  logDate: string | null;
}

export interface ScheduleTemplateDetail extends ScheduleTemplateSummary {
  days: ScheduleDayValue[];
}

export interface ScheduleTemplatePayload {
  name: string;
  description?: string | null;
  days: ScheduleDayValue[];
}

function authHeaders() {
  const token = localStorage.getItem("auth_token");
  if (!token) throw new ApiError("No token found", 401);
  return { Authorization: `Bearer ${token}` };
}

export function useScheduleTemplates() {
  return useQuery<ScheduleTemplateSummary[], ApiError>({
    queryKey: queryKeys.schedules.templates(),
    queryFn: () =>
      apiFetch<ScheduleTemplateSummary[]>("/schedules/templates", {
        headers: authHeaders(),
      }),
  });
}

/** Fetch a full template (with its day rows). Enable by passing an id. */
export function useScheduleTemplate(id: string | null) {
  return useQuery<ScheduleTemplateDetail, ApiError>({
    queryKey: queryKeys.schedules.template(id ?? ""),
    queryFn: () =>
      apiFetch<ScheduleTemplateDetail>(`/schedules/templates/${id}`, {
        headers: authHeaders(),
      }),
    enabled: !!id,
  });
}

export function useCreateScheduleTemplate() {
  const qc = useQueryClient();
  return useMutation<{ id: string }, ApiError, ScheduleTemplatePayload>({
    mutationFn: (body) =>
      apiFetch("/schedules/templates", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.schedules.templates() });
    },
  });
}

export function useUpdateScheduleTemplate() {
  const qc = useQueryClient();
  return useMutation<
    { message: string },
    ApiError,
    { id: string } & ScheduleTemplatePayload
  >({
    mutationFn: ({ id, ...body }) =>
      apiFetch(`/schedules/templates/${id}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.schedules.templates() });
    },
  });
}

export function useDeleteScheduleTemplate() {
  const qc = useQueryClient();
  return useMutation<{ message: string }, ApiError, string>({
    mutationFn: (id) =>
      apiFetch(`/schedules/templates/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.schedules.templates() });
    },
  });
}
