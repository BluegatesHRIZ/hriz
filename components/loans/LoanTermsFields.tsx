"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

/**
 * The loan terms form from the legacy Advances screen: loan type, amounts,
 * dates, how often it is collected, and the computed total and estimated end.
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
  const end = estimatedEndDate(value);
  const number = (raw: string) => {
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : 0;
  };

  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-6">
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-type`}>Loan type</Label>
        <Select
          value={value.loanType}
          onValueChange={(v) => set("loanType", v)}
          disabled={disabled}
        >
          <SelectTrigger id={`${idPrefix}-type`}>
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            {typeOptions.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-amount`}>Loan amount</Label>
        <Input
          id={`${idPrefix}-amount`}
          type="number"
          step="0.01"
          min="0"
          value={value.loanAmount}
          onChange={(e) => set("loanAmount", number(e.target.value))}
          readOnly={loanAmountReadOnly}
          disabled={disabled}
          className={loanAmountReadOnly ? "bg-muted text-right" : "text-right"}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-installment`}>Installment amount</Label>
        <Input
          id={`${idPrefix}-installment`}
          type="number"
          step="0.01"
          min="0"
          value={value.installmentAmount}
          onChange={(e) => set("installmentAmount", number(e.target.value))}
          disabled={disabled}
          className="text-right"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-issued`}>Date issued</Label>
        <Input
          id={`${idPrefix}-issued`}
          type="date"
          value={value.dateIssued}
          onChange={(e) => set("dateIssued", e.target.value)}
          disabled={disabled}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-permonth`}>Monthly installment</Label>
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
            <SelectItem value="1">Once</SelectItem>
            <SelectItem value="2">Twice</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-cutoff`}>Applied installment</Label>
        <Select
          value={once ? value.payCutoff : ""}
          onValueChange={(v) => set("payCutoff", v === "1" ? "1" : v === "2" ? "2" : "")}
          disabled={disabled || !once}
        >
          <SelectTrigger id={`${idPrefix}-cutoff`}>
            <SelectValue placeholder={once ? "Select" : "Every cutoff"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">1st Cutoff</SelectItem>
            <SelectItem value="2">2nd Cutoff</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="hidden lg:block" aria-hidden="true" />

      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-added`}>Added amount</Label>
        <Input
          id={`${idPrefix}-added`}
          type="number"
          step="0.01"
          min="0"
          value={value.addedAmount}
          onChange={(e) => set("addedAmount", number(e.target.value))}
          disabled={disabled}
          className="text-right"
        />
      </div>

      <div className="space-y-1">
        <Label>Total amount</Label>
        <p className="flex h-9 items-center justify-end font-mono text-sm">
          {formatMoney(loanTotal(value))}
        </p>
      </div>

      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-start`}>Date start</Label>
        <Input
          id={`${idPrefix}-start`}
          type="date"
          value={value.dateStart}
          onChange={(e) => set("dateStart", e.target.value)}
          disabled={disabled}
        />
      </div>

      <div className="space-y-1">
        <Label>Estimated date end</Label>
        <p className="flex h-9 items-center font-mono text-sm">{formatInputDate(end)}</p>
      </div>
    </div>
  );
}
