"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";
import { useDepartments, useLocations } from "@/lib/hooks/useEmployeeDetail";

export interface ScheduleFilters {
  search: string;
  dept: string;
  loc: string;
}

export const EMPTY_FILTERS: ScheduleFilters = { search: "", dept: "", loc: "" };

const ALL = "__all__";

interface ScheduleFilterBarProps {
  value: ScheduleFilters;
  onChange: (next: ScheduleFilters) => void;
}

/** Search + department + location filter row shared by both schedule modes. */
export function ScheduleFilterBar({ value, onChange }: ScheduleFilterBarProps) {
  const { data: departments } = useDepartments();
  const { data: locations } = useLocations();

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or ID…"
          value={value.search}
          onChange={(e) => onChange({ ...value, search: e.target.value })}
          className="pl-8"
        />
      </div>

      <Select
        value={value.dept || ALL}
        onValueChange={(v) => onChange({ ...value, dept: v === ALL ? "" : v })}
      >
        <SelectTrigger className="w-full sm:w-52">
          <SelectValue placeholder="All departments" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All departments</SelectItem>
          {departments?.map((d) => (
            <SelectItem key={d.dep_id} value={d.dep_id}>
              {d.dep_desc ?? d.dep_id}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={value.loc || ALL}
        onValueChange={(v) => onChange({ ...value, loc: v === ALL ? "" : v })}
      >
        <SelectTrigger className="w-full sm:w-52">
          <SelectValue placeholder="All locations" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All locations</SelectItem>
          {locations?.map((l) => (
            <SelectItem key={l.loc_id} value={l.loc_id}>
              {l.loc_desc ?? l.loc_id}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
