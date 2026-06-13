"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface YearFilterProps {
  year: string;
  onYearChange: (year: string) => void;
  onLoad: () => void;
  loading?: boolean;
  loadLabel?: string;
}

export function YearFilter({
  year,
  onYearChange,
  onLoad,
  loading,
  loadLabel = "Load Year",
}: YearFilterProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div className="space-y-1.5">
        <Label htmlFor="contribution-year">Year</Label>
        <Input
          id="contribution-year"
          type="number"
          min={2000}
          max={2100}
          value={year}
          onChange={(e) => onYearChange(e.target.value)}
        />
      </div>
      <div className="flex items-end">
        <Button onClick={onLoad} disabled={loading}>
          {loading ? "Loading..." : loadLabel}
        </Button>
      </div>
    </div>
  );
}
