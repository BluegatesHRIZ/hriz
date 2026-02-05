import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format date as YYYY-MM-DDTHH:mm:ss (matches MySQL DATETIME format, no milliseconds/timezone).
 */
function formatDateTime(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

/**
 * Recursively convert BigInt values to number and Date objects to ISO strings so JSON.stringify can serialize.
 * MySQL/Prisma raw queries return BIGINT as JS BigInt, which JSON cannot serialize.
 * Date objects are formatted as YYYY-MM-DDTHH:mm:ss to match MySQL DATETIME format.
 */
export function serializeForJson<T>(value: T): T {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === "bigint") {
    return Number(value) as T;
  }
  if (value instanceof Date) {
    return formatDateTime(value) as T;
  }
  if (Array.isArray(value)) {
    return value.map(serializeForJson) as T;
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (v instanceof Date) {
        out[k] = formatDateTime(v);
      } else if (typeof v === "bigint") {
        out[k] = Number(v);
      } else {
        out[k] = serializeForJson(v);
      }
    }
    return out as T;
  }
  return value;
}
