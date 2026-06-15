"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useUploadFile, useDeleteFile } from "@/lib/hooks/useUpload"
import { useToast } from "@/lib/hooks/use-toast"
import { X, File, Eye } from "lucide-react"
import Image from "next/image"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface FileUploadProps {
  path: string
  fk: string
  type: string
  onUploadComplete?: (files: any[]) => void
  existingFiles?: any[]
  accept?: string
  multiple?: boolean
}

export function FileUpload({
  path,
  fk,
  type,
  onUploadComplete,
  existingFiles = [],
  accept = ".png,.jpeg,.jpg,.pdf",
  multiple = true,
}: FileUploadProps) {
  const { toast } = useToast()
  const uploadMutation = useUploadFile()
  const deleteMutation = useDeleteFile()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<any[]>(existingFiles)
  const [previewFile, setPreviewFile] = useState<any | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    if (selectedFiles.length === 0) return

    // Validate file types
    const allowedTypes = accept.split(",").map((ext) => ext.trim().toLowerCase())
    const invalidFiles = selectedFiles.filter(
      (file) => !allowedTypes.some((ext) => file.name.toLowerCase().endsWith(ext))
    )

    if (invalidFiles.length > 0) {
      toast({
        title: "Invalid file type",
        description: `Only ${accept} files are allowed`,
        variant: "destructive",
      })
      return
    }

    try {
      const uploaded = await uploadMutation.mutateAsync({
        path,
        fk,
        type,
        files: selectedFiles,
      })

      const updatedFiles = [...files, ...uploaded]
      setFiles(updatedFiles)
      onUploadComplete?.(updatedFiles)

      toast({
        title: "Success",
        description: "Files uploaded successfully",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to upload files",
        variant: "destructive",
      })
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleDeleteFile = async (fileId: string) => {
    try {
      await deleteMutation.mutateAsync(fileId)
      const updatedFiles = files.filter((f) => f.fil_id !== fileId)
      setFiles(updatedFiles)
      onUploadComplete?.(updatedFiles)

      toast({
        title: "Success",
        description: "File deleted successfully",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete file",
        variant: "destructive",
      })
    }
  }

  const handlePreview = (file: any) => {
    setPreviewFile(file)
    setPreviewOpen(true)
  }

  const isImage = (fileName: string) => {
    return /\.(png|jpeg|jpg)$/i.test(fileName)
  }

  return (
    <div className="space-y-2">
      <Input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleFileChange}
        disabled={uploadMutation.isPending}
        className="cursor-pointer"
      />

      {files.length > 0 && (
        <div className="border rounded-md p-4 space-y-2">
          <Label className="text-sm font-medium">Uploaded Files</Label>
          <div className="space-y-2">
            {files.map((file) => (
              <div
                key={file.fil_id}
                className="flex items-center justify-between p-2 border rounded hover:bg-muted/50"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <File className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm truncate">{file.fil_name || file.name}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {isImage(file.fil_name || file.name) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePreview(file)}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteFile(file.fil_id)}
                    disabled={deleteMutation.isPending}
                  >
                    <X className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{previewFile?.fil_name || previewFile?.name}</DialogTitle>
          </DialogHeader>
          {previewFile && (
            <div className="relative w-full h-[600px]">
              {isImage(previewFile.fil_name || previewFile.name) ? (
                <Image
                  src={previewFile.fil_url || previewFile.path}
                  alt={previewFile.fil_name || previewFile.name}
                  fill
                  className="object-contain"
                />
              ) : (
                <iframe
                  src={previewFile.fil_url || previewFile.path}
                  className="w-full h-full"
                  title={previewFile.fil_name || previewFile.name}
                />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
