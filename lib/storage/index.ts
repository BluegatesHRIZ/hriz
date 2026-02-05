import { IStorageService } from "./types"
import { SupabaseStorageService } from "./supabase"

/**
 * Storage Service Factory
 * Returns the configured storage service based on environment variables
 */
export function getStorageService(): IStorageService {
  const storageProvider = process.env.STORAGE_PROVIDER || "supabase"

  switch (storageProvider) {
    case "supabase":
      return new SupabaseStorageService()
    // Future: Add Cloudflare R2 support
    // case "cloudflare-r2":
    //   return new CloudflareR2StorageService()
    default:
      throw new Error(`Unknown storage provider: ${storageProvider}`)
  }
}

// Export singleton instance
export const storageService = getStorageService()
