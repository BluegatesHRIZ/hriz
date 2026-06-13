import { callProc } from "@/lib/db/mariadb";

/**
 * Government contribution reports — mirrors C# ContributionController
 * (`crearep_sss`, `crearep_hdmf`, `crearep_phic`).
 */

export interface SssContributionRow {
  pyh_code: string | null;
  emp_sss: string | null;
  emp_name: string | null;
  pyh_desc: string | null;
  salary: number | null;
  ec: number | null;
  wisp: number | null;
  msct: number | null;
  rsser: number | null;
  rssee: number | null;
  rsst: number | null;
  ecer: number | null;
  ecee: number | null;
  ect: number | null;
  wisper: number | null;
  wipee: number | null;
  wispt: number | null;
  ter: number | null;
  tee: number | null;
  tt: number | null;
}

export interface HdmfContributionRow {
  pyh_code: string | null;
  emp_pagibig: string | null;
  emp_name: string | null;
  pyh_desc: string | null;
  salary: number | null;
  pyd_hdmf: number | null;
  pyd_hdmfer: number | null;
}

export interface PhicContributionRow {
  pyh_code: string | null;
  emp_philhealth: string | null;
  emp_name: string | null;
  pyh_desc: string | null;
  salary: number | null;
  pyd_phic: number | null;
  pyd_phicer: number | null;
}

function normalizeRow<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (typeof value === "bigint") {
      out[key] = Number(value);
    } else if (value instanceof Date) {
      out[key] = value;
    } else {
      out[key] = value as unknown;
    }
  }
  return out as T;
}

function pickString(row: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const val = row[key];
    if (val === null || val === undefined) continue;
    return typeof val === "string" ? val : String(val);
  }
  return null;
}

function pickNumber(row: Record<string, unknown>, ...keys: string[]): number | null {
  for (const key of keys) {
    const val = row[key];
    if (val === null || val === undefined) continue;
    if (typeof val === "number") return val;
    if (typeof val === "bigint") return Number(val);
    if (typeof val === "string") {
      const parsed = Number(val);
      return Number.isFinite(parsed) ? parsed : null;
    }
    const coerced = Number(val as unknown);
    return Number.isFinite(coerced) ? coerced : null;
  }
  return null;
}

function mapSss(row: Record<string, unknown>): SssContributionRow {
  return {
    pyh_code: pickString(row, "pyh_code"),
    emp_sss: pickString(row, "emp_sss"),
    emp_name: pickString(row, "emp_name"),
    pyh_desc: pickString(row, "pyh_desc"),
    salary: pickNumber(row, "salary"),
    ec: pickNumber(row, "ec"),
    wisp: pickNumber(row, "wisp"),
    msct: pickNumber(row, "msct"),
    rsser: pickNumber(row, "rsser"),
    rssee: pickNumber(row, "rssee"),
    rsst: pickNumber(row, "rsst"),
    ecer: pickNumber(row, "ecer"),
    ecee: pickNumber(row, "ecee"),
    ect: pickNumber(row, "ect"),
    wisper: pickNumber(row, "wisper"),
    wipee: pickNumber(row, "wipee"),
    wispt: pickNumber(row, "wispt"),
    ter: pickNumber(row, "ter"),
    tee: pickNumber(row, "tee"),
    tt: pickNumber(row, "tt"),
  };
}

function mapHdmf(row: Record<string, unknown>): HdmfContributionRow {
  return {
    pyh_code: pickString(row, "pyh_code"),
    emp_pagibig: pickString(row, "emp_pagibig"),
    emp_name: pickString(row, "emp_name"),
    pyh_desc: pickString(row, "pyh_desc"),
    salary: pickNumber(row, "salary"),
    pyd_hdmf: pickNumber(row, "pyd_hdmf"),
    pyd_hdmfer: pickNumber(row, "pyd_hdmfer"),
  };
}

function mapPhic(row: Record<string, unknown>): PhicContributionRow {
  return {
    pyh_code: pickString(row, "pyh_code"),
    emp_philhealth: pickString(row, "emp_philhealth"),
    emp_name: pickString(row, "emp_name"),
    pyh_desc: pickString(row, "pyh_desc"),
    salary: pickNumber(row, "salary"),
    pyd_phic: pickNumber(row, "pyd_phic"),
    pyd_phicer: pickNumber(row, "pyd_phicer"),
  };
}

export async function listSssContribution(
  year: number,
  emp: string = "All",
): Promise<SssContributionRow[]> {
  const rows = await callProc(`CALL crearep_sss(?, ?)`, [year, emp]);
  return rows.map((r) => mapSss(normalizeRow(r)));
}

export async function listHdmfContribution(
  year: number,
  emp: string = "All",
): Promise<HdmfContributionRow[]> {
  const rows = await callProc(`CALL crearep_hdmf(?, ?)`, [year, emp]);
  return rows.map((r) => mapHdmf(normalizeRow(r)));
}

export async function listPhicContribution(
  year: number,
  emp: string = "All",
): Promise<PhicContributionRow[]> {
  const rows = await callProc(`CALL crearep_phic(?, ?)`, [year, emp]);
  return rows.map((r) => mapPhic(normalizeRow(r)));
}
