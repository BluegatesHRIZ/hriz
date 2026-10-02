/**
 * Salary history rules shared by the Salary History tab and its API route.
 *
 * An employee has at most one Present (`emp_salstatus = 1`) salary. Adding a
 * new Present salary ends the one it replaces, so the table always agrees with
 * what payroll uses (`loadSalaries` picks the latest Present row anyway).
 */

export const SALARY_ENDED = 0;
export const SALARY_PRESENT = 1;

export interface SalaryPeriod {
  SalDateFrom: Date | string | null;
  SalDateTo: Date | string | null;
  SalStatus: number;
}

const toDate = (d: Date | string) => (d instanceof Date ? d : new Date(d));

export function countPresent(rows: SalaryPeriod[]): number {
  return rows.filter((r) => r.SalStatus === SALARY_PRESENT).length;
}

export type ApplyPresentResult<T> =
  | { ok: true; rows: T[]; ended: T[] }
  | { ok: false; error: string };

/**
 * Make `rows[index]` the only Present salary.
 *
 * Every other Present row that started earlier is ended the day before the
 * new one starts. A Present row starting on the same day or later is not
 * guessed at — that is refused, and the user ends it by hand.
 *
 * Rows that are not Present at `index` are returned unchanged.
 */
export function applyPresent<T extends SalaryPeriod>(
  rows: T[],
  index: number,
): ApplyPresentResult<T> {
  const target = rows[index];
  if (!target || target.SalStatus !== SALARY_PRESENT || !target.SalDateFrom) {
    return { ok: true, rows, ended: [] };
  }

  const start = toDate(target.SalDateFrom);
  const dayBefore = new Date(start);
  dayBefore.setDate(dayBefore.getDate() - 1);

  const ended: T[] = [];
  const next = [...rows];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (i === index || row.SalStatus !== SALARY_PRESENT) continue;

    if (!row.SalDateFrom || toDate(row.SalDateFrom) >= start) {
      return {
        ok: false,
        error:
          "Another Present salary starts on or after this one. End that salary first, or pick a later Date From.",
      };
    }

    const closed = { ...row, SalDateTo: dayBefore, SalStatus: SALARY_ENDED };
    next[i] = closed;
    ended.push(closed);
  }

  return { ok: true, rows: next, ended };
}
