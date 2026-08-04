/**
 * Premium pay — overtime, night differential, rest day and holiday work.
 *
 * `attendance` carries 31 premium hour buckets (`att_ot` … `att_dhrdndot`) and
 * `otrates` carries a multiplier column of exactly the same name for each one.
 * `attendance-recompute.ts` has already classified every worked hour into the
 * right bucket, honouring approved overtime requests, rest days and the
 * holiday type. This module only prices what is already there.
 *
 *     amount = bucket_hours x otrates[bucket] x hourly_rate
 *
 * MULTIPLIER SEMANTICS
 * --------------------
 * The live `OT1` row mixes two kinds of figure, which is not a bug:
 *
 *   ot   1.25   full replacement rate — an OT hour is paid at 125%
 *   rd   1.30   full replacement rate — a rest-day hour is paid at 130%
 *   nd   0.10   PREMIUM ONLY — night differential adds 10% on top
 *   sh   0.30   PREMIUM ONLY — special holiday adds 30%
 *   lh   1.00   PREMIUM ONLY — a legal holiday adds another day's pay
 *   dh   1.60   PREMIUM ONLY — double holiday
 *
 * Both kinds are handled identically (hours x multiplier x hourly) because the
 * table already encodes the distinction in the number itself: a premium-only
 * bucket carries the increment, a replacement bucket carries the whole rate.
 * The regular hours behind a premium-only bucket are already inside the
 * employee's fixed `basic`, so adding only the increment is correct.
 *
 * NO PARITY DATA
 * --------------
 * None of the 12 posted runs contains bucket-derived premium pay — the single
 * non-zero `CD2` in the whole database is a flat 1,500 keyed in on a voided
 * run, and the client's sample DTR week has zero overtime recorded. This module
 * therefore cannot be validated against history the way rates and statutory
 * were. It is written to the literal reading of `otrates`, and the semantics
 * above should be confirmed with the client before the first live run that
 * actually contains overtime.
 */

import type { PayComponent, RateLadder } from "./types";

/**
 * The 31 premium buckets, named identically in `attendance` (prefixed `att_`)
 * and in `otrates` (bare). Order follows the schema.
 *
 * Naming: rd = rest day, nd = night differential, ot = overtime,
 * sh = special holiday, lh = legal holiday, dh = double holiday. Suffixes
 * compose, so `shrdndot` is special-holiday + rest-day + night-diff overtime.
 */
export const PREMIUM_BUCKETS = [
  "ot",
  "nd",
  "ndot",
  "rd",
  "rdot",
  "rdnd",
  "rdndot",
  "sh",
  "shot",
  "shnd",
  "shndot",
  "shrd",
  "shrdot",
  "shrdnd",
  "shrdndot",
  "lh",
  "lhot",
  "lhnd",
  "lhndot",
  "lhrd",
  "lhrdot",
  "lhrdnd",
  "lhrdndot",
  "dh",
  "dhot",
  "dhnd",
  "dhndot",
  "dhrd",
  "dhrdot",
  "dhrdnd",
  "dhrdndot",
] as const;

export type PremiumBucket = (typeof PREMIUM_BUCKETS)[number];

/** Hours per bucket for one employee across a cutoff. */
export type PremiumHours = Partial<Record<PremiumBucket, number>>;

/** An `otrates` row, keyed by `rts` (e.g. "OT1"). */
export type OvertimeRates = Partial<Record<PremiumBucket, number>> & { rts?: string };

/** One priced bucket, kept for the payslip breakdown. */
export interface PremiumLine {
  bucket: PremiumBucket;
  hours: number;
  multiplier: number;
  amount: number;
}

export interface PremiumResult {
  lines: PremiumLine[];
  totalHours: number;
  totalAmount: number;
}

/** `comded` code for premium pay. */
export const CD_OVERTIME = "CD2";

/**
 * Convert a MySQL `TIME` value to whole minutes.
 *
 * `attendance` stores every bucket as `TIME(0)`, and TIME can legitimately
 * exceed 24 hours (the column tops out at 838:59:59), so `Date` parsing is not
 * safe here. Accepts "HH:MM:SS", a Date, or a number already in minutes.
 *
 * Working in minutes rather than float hours is deliberate — float hours are
 * what produce the `7.999999999941792` drift in the client's spreadsheet.
 */
export function timeToMinutes(value: string | Date | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  if (value instanceof Date) {
    return value.getUTCHours() * 60 + value.getUTCMinutes();
  }
  const m = /^(-?)(\d+):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!m) return 0;
  const sign = m[1] === "-" ? -1 : 1;
  const hours = Number(m[2]);
  const minutes = Number(m[3]);
  const seconds = Number(m[4] ?? 0);
  return sign * (hours * 60 + minutes + Math.round(seconds / 60));
}

/** Minutes -> hours, the unit `otrates` multipliers apply to. */
export function minutesToHours(minutes: number): number {
  return minutes / 60;
}

/**
 * Price every non-zero premium bucket.
 *
 * Buckets with zero hours are skipped so a payslip only lists what was earned.
 * A bucket with hours but no configured multiplier contributes nothing and is
 * reported with `multiplier: 0`, which makes a misconfigured `otrates` row
 * visible on the payslip rather than silently swallowing pay.
 */
export function pricePremiums(
  hours: PremiumHours,
  rates: OvertimeRates,
  ladder: RateLadder,
): PremiumResult {
  const lines: PremiumLine[] = [];
  let totalHours = 0;
  let totalAmount = 0;

  for (const bucket of PREMIUM_BUCKETS) {
    const h = hours[bucket] ?? 0;
    if (!h) continue;
    const multiplier = rates[bucket] ?? 0;
    const amount = h * multiplier * ladder.hourly;
    lines.push({ bucket, hours: h, multiplier, amount });
    totalHours += h;
    totalAmount += amount;
  }

  return { lines, totalHours, totalAmount };
}

/**
 * Collapse the priced buckets into the single `CD2` component the legacy
 * payslip format expects. The per-bucket detail stays available on
 * `PremiumResult.lines` for the payslip breakdown.
 */
export function premiumComponent(result: PremiumResult): PayComponent {
  return {
    code: CD_OVERTIME,
    type: "C",
    amount: result.totalAmount,
    taxable: true,
    description: result.lines
      .map((l) => `${l.bucket} ${l.hours}h x${l.multiplier}`)
      .join(", "),
  };
}

/**
 * Sum per-day attendance rows into per-bucket hour totals.
 *
 * `days` holds raw MySQL TIME values straight from `attendance`; minutes are
 * accumulated as integers and converted to hours only at the end.
 */
export function accumulateBuckets(
  days: Array<Partial<Record<PremiumBucket, string | Date | number | null>>>,
): PremiumHours {
  const minutes = new Map<PremiumBucket, number>();
  for (const day of days) {
    for (const bucket of PREMIUM_BUCKETS) {
      const m = timeToMinutes(day[bucket] ?? null);
      if (!m) continue;
      minutes.set(bucket, (minutes.get(bucket) ?? 0) + m);
    }
  }
  const out: PremiumHours = {};
  for (const [bucket, m] of minutes) out[bucket] = minutesToHours(m);
  return out;
}
