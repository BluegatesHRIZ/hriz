"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch, ApiError } from "@/lib/api/client"

export interface FileModel {
  name: string
  path: string
}

export interface UploadFileParams {
  path: string
  fk: string
  type: string
  files: File[]
}

/**
 * Hook for uploading files
 */
export function useUploadFile() {
  const queryClient = useQueryClient()

  return useMutation<FileModel[], ApiError, UploadFileParams>({
    mutationFn: async ({ path, fk, type, files }) => {
      const token = localStorage.getItem("auth_token")
      if (!token) throw new ApiError("No token found", 401)

      const formData = new FormData()
      files.forEach((file) => {
        formData.append("files", file)
      })

      const response = await fetch(`/api/upload/${path}/${fk}/${type}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new ApiError(error.message || "Upload failed", response.status)
      }

      return response.json()
    },
    onSuccess: () => {
      // Invalidate file-related queries
      queryClient.invalidateQueries({ queryKey: ["files"] })
    },
  })
}

/**
 * Hook for deleting files
 */
export function useDeleteFile() {
  const queryClient = useQueryClient()

  return useMutation<{ name: string }, ApiError, string>({
    mutationFn: async (fileId: string) => {
      const token = localStorage.getItem("auth_token")
      if (!token) throw new ApiError("No token found", 401)

      return apiFetch<{ name: string }>(`/upload/file/${fileId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files"] })
    },
  })
}

/**
 * Hook for getting files by foreign key
 */
export function useFiles(fk: string, enabled: boolean = true) {
  return useQuery<FileModel[], ApiError>({
    queryKey: ["files", fk],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token")
      if (!token) throw new ApiError("No token found", 401)

      // TODO: Create API endpoint to get files by FK
      // For now, return empty array
      return []
    },
    enabled: enabled && !!fk,
  })
}
