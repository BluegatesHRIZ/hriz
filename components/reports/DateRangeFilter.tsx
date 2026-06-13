"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface DateRangeFilterProps {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  disabled?: boolean;
}

/**
 * Two paired date inputs used by attendance / leave / overtime reports.
 */
export function DateRangeFilter({
  from,
  to,
  onFromChange,
  onToChange,
  disabled,
}: DateRangeFilterProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="report-from">Date from</Label>
        <Input
          id="report-from"
          type="date"
          value={from}
          disabled={disabled}
          onChange={(e) => onFromChange(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="report-to">Date to</Label>
        <Input
          id="report-to"
          type="date"
          value={to}
          disabled={disabled}
          onChange={(e) => onToChange(e.target.value)}
        />
      </div>
    </div>
  );
}
