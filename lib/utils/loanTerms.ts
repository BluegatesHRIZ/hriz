import type { LoanTerms } from "@/lib/types";

/** Days one month of installments is spread over when estimating the end date. */
const DAYS_PER_MONTH = 31;

export function todayInputDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function emptyLoanTerms(overrides: Partial<LoanTerms> = {}): LoanTerms {
  const today = todayInputDate();
  return {
    loanType: "",
    loanAmount: 0,
    addedAmount: 0,
    installmentAmount: 0,
    dateIssued: today,
    dateStart: today,
    payPerMonth: "2",
    payCutoff: "",
    ...overrides,
  };
}

/** Loan amount plus added amount. */
export function loanTotal(terms: Pick<LoanTerms, "loanAmount" | "addedAmount">): number {
  return (terms.loanAmount || 0) + (terms.addedAmount || 0);
}

/**
 * Estimated date the loan is fully paid, as YYYY-MM-DD, or null when it cannot
 * be worked out yet.
 *
 * Number of installments = total / installment amount. Each installment covers
 * half a month when paid twice a month and a full month when paid once.
 * Example: 10,100 at 500 twice a month from 2026-10-21 gives 2027-08-30.
 */
export function estimatedEndDate(terms: LoanTerms): string | null {
  const total = loanTotal(terms);
  if (!terms.dateStart || total <= 0 || terms.installmentAmount <= 0) return null;
  const [y, m, d] = terms.dateStart.split("-").map(Number);
  if (!y || !m || !d) return null;
  const installments = total / terms.installmentAmount;
  const days = Math.round(installments * (DAYS_PER_MONTH / Number(terms.payPerMonth)));
  const end = new Date(Date.UTC(y, m - 1, d + days));
  return end.toISOString().slice(0, 10);
}

/** Returns the first problem with the terms, or null when they can be saved. */
export function validateLoanTerms(terms: LoanTerms): string | null {
  if (!terms.loanType.trim()) return "Select a loan type.";
  if (!(terms.loanAmount > 0)) return "Loan amount must be greater than zero.";
  if (terms.addedAmount < 0) return "Added amount cannot be negative.";
  if (!(terms.installmentAmount > 0)) return "Installment amount must be greater than zero.";
  if (terms.installmentAmount > loanTotal(terms)) {
    return "Installment amount cannot be more than the total amount.";
  }
  if (!terms.dateIssued) return "Date issued is required.";
  if (!terms.dateStart) return "Date start is required.";
  return null;
}

export function formatMoney(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** YYYY-MM-DD to MM/DD/YYYY for display. */
export function formatInputDate(value: string | null | undefined): string {
  if (!value) return "-";
  const [y, m, d] = value.slice(0, 10).split("-");
  if (!y || !m || !d) return "-";
  return `${m}/${d}/${y}`;
}

export const PAY_PER_MONTH_LABEL: Record<string, string> = {
  "1": "Once",
  "2": "Twice",
};

export const PAY_CUTOFF_LABEL: Record<string, string> = {
  "1": "1st Cutoff",
  "2": "2nd Cutoff",
};
