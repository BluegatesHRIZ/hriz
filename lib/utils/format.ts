/**
 * Display formatters shared across the app, so every screen shows dates and
 * money the same way: dates as MM-DD-YYYY, amounts as 1,500.00.
 */

import { format, isValid } from "date-fns";

/** Display format for a calendar date. */
export const DATE_FORMAT = "MM-dd-yyyy";

/** `10-17-1977`; `fallback` for null, empty or unparseable input. */
export function formatDate(
  value: Date | string | number | null | undefined,
  fallback = "-",
): string {
  if (value === null || value === undefined || value === "") return fallback;
  const date = value instanceof Date ? value : new Date(value);
  return isValid(date) ? format(date, DATE_FORMAT) : fallback;
}

/** `1,500.00`; `fallback` for null or non-finite input. */
export function formatAmount(
  value: number | null | undefined,
  fallback = "-",
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return fallback;
  }
  return value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
