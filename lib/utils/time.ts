/**
 * Time utility functions for handling MySQL TIME fields
 * 
 * MySQL TIME fields are timezone-agnostic (just time values, not timestamps).
 * Prisma returns them as Date objects, which can cause timezone conversion issues.
 * 
 * IMPORTANT: These utilities are ONLY for display purposes. Stored procedures
 * work directly with MySQL TIME values and are not affected by timezone.
 */

/**
 * Convert a Date object (from Prisma TIME field) to HH:mm format for HTML time input
 * 
 * CRITICAL: MySQL TIME fields are timezone-agnostic (just time values, not timestamps).
 * 
 * The issue: Prisma may return TIME fields as Date objects, but the timezone interpretation
 * depends on how Prisma/MySQL driver handles it. We need to extract the time WITHOUT
 * timezone conversion to match C# TimeSpan behavior.
 * 
 * After investigation: Prisma returns TIME fields as Date objects where the date portion
 * is "1970-01-01" and the time portion matches the database value. However, JavaScript Date
 * objects are timezone-aware, so we need to be careful.
 * 
 * If the database has "08:00:00" and Prisma creates a Date object:
 * - The Date might be "1970-01-01T08:00:00Z" (UTC) OR "1970-01-01T08:00:00+09:00" (local)
 * - We need to extract the time portion that matches what's in the database
 * 
 * Solution: Try both UTC and local methods, but prefer UTC since MySQL TIME is stored
 * without timezone. However, if Prisma is applying timezone conversion, we may need
 * to use local methods instead.
 */
export function formatTimeForInput(time: Date | null): string | null {
  if (!time) return null
  
  // MySQL TIME fields are timezone-agnostic (just time values, not timestamps).
  // Prisma returns them as Date objects in UTC format (e.g., "1970-01-01T08:00:00Z").
  // 
  // C# Entity Framework maps TIME directly to TimeSpan (timezone-agnostic),
  // so "08:00:00" becomes TimeSpan(8, 0, 0) without any conversion.
  //
  // Solution: Use getUTCHours() to extract the raw time value without timezone conversion,
  // matching C# TimeSpan behavior (timezone-agnostic).
  
  const hours = time.getUTCHours().toString().padStart(2, "0")
  const minutes = time.getUTCMinutes().toString().padStart(2, "0")
  
  return `${hours}:${minutes}`
}

/**
 * Convert a Date object (from Prisma TIME field) to HH:mm:ss format
 * For use in API responses where full time format is needed
 * Uses UTC methods to match C# TimeSpan behavior (timezone-agnostic)
 */
export function formatTimeForDisplay(time: Date | null): string | null {
  if (!time) return null
  // Use UTC methods to extract raw time value without timezone conversion
  // This matches C# TimeSpan behavior (timezone-agnostic)
  const hours = time.getUTCHours().toString().padStart(2, "0")
  const minutes = time.getUTCMinutes().toString().padStart(2, "0")
  const seconds = time.getUTCSeconds().toString().padStart(2, "0")
  return `${hours}:${minutes}:${seconds}`
}

/**
 * Convert HH:mm or HH:mm:ss string to HH:mm:00 format for MySQL stored procedures
 * Removes seconds and ensures proper format (matching C# Times.RemoveSeconds)
 */
export function formatTimeForDatabase(timeStr: string): string {
  if (!timeStr) return "00:00:00"
  // Handle both "HH:mm" and "HH:mm:ss" formats
  const parts = timeStr.split(":")
  if (parts.length >= 2) {
    return `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}:00`
  }
  return "00:00:00"
}

/**
 * Get current time in HH:mm:ss format for attendance/biolog
 * Uses local time since this is for recording actual clock times
 */
export function getCurrentTimeString(): string {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`
}

/**
 * Remove seconds from a Date object (matching C# Times.RemoveSeconds)
 * Returns a new Date with seconds set to 0
 */
export function removeSeconds(date: Date): Date {
  const result = new Date(date)
  result.setSeconds(0, 0)
  return result
}
