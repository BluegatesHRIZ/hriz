import { createClient, SupabaseClient } from "@supabase/supabase-js"
import { IStorageService } from "./types"

/**
 * Supabase Storage Service Implementation
 * Implements S3-compatible storage using Supabase Storage
 */
export class SupabaseStorageService implements IStorageService {
  private supabase: SupabaseClient
  private bucketName: string

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      throw new Error(
        "Supabase credentials not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY in .env"
      )
    }

    if (!supabaseUrl.includes("supabase.co")) {
      console.warn("Warning: SUPABASE_URL does not appear to be a valid Supabase URL")
    }

    this.supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
      },
    })
    this.bucketName = process.env.SUPABASE_BUCKET_NAME || "hris-files"
    
    console.log(`Supabase Storage initialized with bucket: ${this.bucketName}`)
  }

  async uploadFile(file: Buffer, path: string, filename: string): Promise<string> {
    try {
      // Construct storage path: {path}/{filename}
      const storagePath = `${path}/${filename}`

      // Check if bucket exists first (only log warning, don't fail - bucket might exist but not be listed)
      try {
        const { data: buckets, error: listError } = await this.supabase.storage.listBuckets()
        
        if (!listError && buckets) {
          const bucketExists = buckets.some((b) => b.name === this.bucketName)
          if (!bucketExists) {
            console.warn(
              `Bucket "${this.bucketName}" not found in list. It may need to be created in Supabase dashboard, or there may be permission issues.`
            )
          }
        }
      } catch (checkError) {
        // Non-fatal - continue with upload attempt
        console.warn("Could not verify bucket existence:", checkError)
      }

      // Upload file to Supabase Storage
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .upload(storagePath, file, {
          contentType: this.getContentType(filename),
          upsert: true, // Allow overwriting existing files
        })

      if (error) {
        console.error("Supabase upload error details:", {
          message: error.message,
          statusCode: error.statusCode,
          error: error,
        })
        
        // Check for DNS/network errors
        const originalError = (error as any).originalError
        const causeError = originalError?.cause || error.cause
        if (
          originalError?.code === "ENOTFOUND" ||
          causeError?.code === "ENOTFOUND" ||
          error.message?.includes("ENOTFOUND") ||
          error.message?.includes("getaddrinfo")
        ) {
          const hostname =
            originalError?.hostname || causeError?.hostname || process.env.SUPABASE_URL || "unknown"
          throw new Error(
            `❌ Cannot connect to Supabase: DNS lookup failed for "${hostname}".\n\n` +
            `This usually means:\n` +
            `1. The Supabase project was deleted or paused - Check your Supabase dashboard: https://supabase.com/dashboard\n` +
            `2. The SUPABASE_URL in .env is incorrect (current: ${process.env.SUPABASE_URL})\n` +
            `3. Network/DNS connectivity issue\n\n` +
            `To fix:\n` +
            `- Go to https://supabase.com/dashboard and verify your project exists\n` +
            `- If the project exists, copy the correct URL from Settings > API\n` +
            `- Update SUPABASE_URL in your .env file\n` +
            `- Restart your Next.js dev server`
          )
        }
        
        // Provide more helpful error messages
        if (error.message.includes("Bucket not found") || error.statusCode === "404") {
          throw new Error(
            `Bucket "${this.bucketName}" does not exist. Please create it in your Supabase dashboard under Storage.`
          )
        }
        
        if (error.message.includes("new row violates row-level security") || error.statusCode === "403") {
          throw new Error(
            `Permission denied. Please check that the bucket "${this.bucketName}" has proper RLS policies or is public.`
          )
        }
        
        throw new Error(`Failed to upload file: ${error.message} (status: ${error.statusCode || "unknown"})`)
      }

      if (!data) {
        throw new Error("Upload succeeded but no data returned")
      }

      // Return the storage path (relative path like "./201/{path}/{filename}")
      // This matches the C# format for database storage
      return `./201/${storagePath}`
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      console.error("Storage upload failed:", errorMessage, error)
      throw new Error(`Storage upload failed: ${errorMessage}`)
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      // Remove "./201/" prefix if present (database format)
      const cleanPath = filePath.replace(/^\.\/201\//, "")

      const { error } = await this.supabase.storage.from(this.bucketName).remove([cleanPath])

      if (error) {
        throw new Error(`Failed to delete file: ${error.message}`)
      }
    } catch (error) {
      throw new Error(`Storage delete failed: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  async getFileUrl(filePath: string): Promise<string> {
    try {
      // Remove "./201/" prefix if present
      const cleanPath = filePath.replace(/^\.\/201\//, "")

      const { data } = this.supabase.storage.from(this.bucketName).getPublicUrl(cleanPath)

      return data.publicUrl
    } catch (error) {
      throw new Error(`Failed to get file URL: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  async listFiles(prefix: string): Promise<string[]> {
    try {
      const { data, error } = await this.supabase.storage.from(this.bucketName).list(prefix)

      if (error) {
        throw new Error(`Failed to list files: ${error.message}`)
      }

      return (data || []).map((file) => `${prefix}/${file.name}`)
    } catch (error) {
      throw new Error(`Failed to list files: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  /**
   * Get content type based on file extension
   */
  private getContentType(filename: string): string {
    const ext = filename.toLowerCase().split(".").pop()
    const contentTypes: Record<string, string> = {
      png: "image/png",
      jpeg: "image/jpeg",
      jpg: "image/jpeg",
      pdf: "application/pdf",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }
    return contentTypes[ext || ""] || "application/octet-stream"
  }
}
