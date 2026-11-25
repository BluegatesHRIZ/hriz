"use client";

import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MoneyInput } from "@/components/ui/money-input";
import type { LoanTerms } from "@/lib/types";
import {
  estimatedEndDate,
  formatInputDate,
  formatMoney,
  loanTotal,
} from "@/lib/utils/loanTerms";

export const DEFAULT_LOAN_TYPES = ["Company Loan", "Salary Advance"] as const;

interface LoanTermsFieldsProps {
  value: LoanTerms;
  onChange: (next: LoanTerms) => void;
  /** Loan types offered in the dropdown. The current value is always included. */
  loanTypes?: readonly string[];
  /** Lock the loan amount, e.g. when it comes from an approved request. */
  loanAmountReadOnly?: boolean;
  /** Prefix for input ids so two forms can sit on one page. */
  idPrefix?: string;
  disabled?: boolean;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-3">
      <legend className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </legend>
      <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function Field({ id, label, children }: { id?: string; label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

/**
 * The loan terms form from the legacy Advances screen, grouped into what is
 * borrowed, how it is collected, and when: loan type, amounts, dates, how
 * often it is collected, and the computed total and estimated end.
 */
export function LoanTermsFields({
  value,
  onChange,
  loanTypes = DEFAULT_LOAN_TYPES,
  loanAmountReadOnly = false,
  idPrefix = "loan",
  disabled = false,
}: LoanTermsFieldsProps) {
  const set = <K extends keyof LoanTerms>(key: K, v: LoanTerms[K]) =>
    onChange({ ...value, [key]: v });

  const typeOptions =
    value.loanType && !loanTypes.includes(value.loanType)
      ? [value.loanType, ...loanTypes]
      : loanTypes;

  const once = value.payPerMonth === "1";
  const total = loanTotal(value);
  const end = estimatedEndDate(value);
  const installments =
    value.installmentAmount > 0 && total > 0 ? Math.ceil(total / value.installmentAmount) : null;

  return (
    <div className="space-y-6">
      <Section title="Loan">
        <Field id={`${idPrefix}-type`} label="Loan type">
          <Select
            value={value.loanType}
            onValueChange={(v) => set("loanType", v)}
            disabled={disabled}
          >
            <SelectTrigger id={`${idPrefix}-type`}>
              <SelectValue placeholder="Select a type" />
            </SelectTrigger>
            <SelectContent>
              {typeOptions.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field id={`${idPrefix}-issued`} label="Date issued">
          <Input
            id={`${idPrefix}-issued`}
            type="date"
            value={value.dateIssued}
            onChange={(e) => set("dateIssued", e.target.value)}
            disabled={disabled}
          />
        </Field>
        <Field id={`${idPrefix}-amount`} label="Loan amount">
          <MoneyInput
            id={`${idPrefix}-amount`}
            value={value.loanAmount}
            onValueChange={(n) => set("loanAmount", n)}
            readOnly={loanAmountReadOnly}
            disabled={disabled}
          />
        </Field>
        <Field id={`${idPrefix}-added`} label="Added amount">
          <MoneyInput
            id={`${idPrefix}-added`}
            value={value.addedAmount}
            onValueChange={(n) => set("addedAmount", n)}
            disabled={disabled}
          />
        </Field>
      </Section>

      <Section title="Repayment">
        <Field id={`${idPrefix}-installment`} label="Installment amount">
          <MoneyInput
            id={`${idPrefix}-installment`}
            value={value.installmentAmount}
            onValueChange={(n) => set("installmentAmount", n)}
            disabled={disabled}
          />
        </Field>
        <Field id={`${idPrefix}-start`} label="Date start">
          <Input
            id={`${idPrefix}-start`}
            type="date"
            value={value.dateStart}
            onChange={(e) => set("dateStart", e.target.value)}
            disabled={disabled}
          />
        </Field>
        <Field id={`${idPrefix}-permonth`} label="Monthly installment">
          <Select
            value={value.payPerMonth}
            onValueChange={(v) =>
              onChange({
                ...value,
                payPerMonth: v === "1" ? "1" : "2",
                // The cutoff only applies when collected once a month.
                payCutoff: v === "1" ? value.payCutoff : "",
              })
            }
            disabled={disabled}
          >
            <SelectTrigger id={`${idPrefix}-permonth`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2">Twice a month</SelectItem>
              <SelectItem value="1">Once a month</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field id={`${idPrefix}-cutoff`} label="Applied installment">
          <Select
            value={once ? value.payCutoff : ""}
            onValueChange={(v) => set("payCutoff", v === "1" ? "1" : v === "2" ? "2" : "")}
            disabled={disabled || !once}
          >
            <SelectTrigger id={`${idPrefix}-cutoff`}>
              <SelectValue placeholder={once ? "Any cutoff" : "Every cutoff"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1st cutoff</SelectItem>
              <SelectItem value="2">2nd cutoff</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </Section>

      <dl className="grid grid-cols-3 divide-x divide-border/60 rounded-lg border border-border/60 bg-muted/40 text-sm">
        <div className="px-4 py-3">
          <dt className="text-xs text-muted-foreground">Total amount</dt>
          <dd className="tabular mt-0.5 font-semibold text-foreground">₱{formatMoney(total)}</dd>
        </div>
        <div className="px-4 py-3">
          <dt className="text-xs text-muted-foreground">Installments</dt>
          <dd className="tabular mt-0.5 font-semibold text-foreground">{installments ?? "-"}</dd>
        </div>
        <div className="px-4 py-3">
          <dt className="text-xs text-muted-foreground">Estimated date end</dt>
          <dd className="tabular mt-0.5 font-semibold text-foreground">{formatInputDate(end)}</dd>
        </div>
      </dl>
    </div>
  );
}
