"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useLocations } from "@/lib/hooks/useEmployeeDetail";
import { cn } from "@/lib/utils";

/**
 * Searchable multi-select over branches (`location`), by their readable name.
 *
 * `selected` holds `loc_id`s. The popover is `modal` so it takes over the
 * scroll lock from the surrounding Dialog — otherwise the list cannot be
 * wheel-scrolled.
 */
export function BranchFilter({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const locations = useLocations();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const options = useMemo(
    () =>
      (locations.data ?? []).map((l) => ({
        id: l.loc_id,
        label: l.loc_desc?.trim() || l.loc_id,
      })),
    [locations.data],
  );
  const labelOf = useMemo(() => new Map(options.map((o) => [o.id, o.label])), [options]);

  const q = query.trim().toLowerCase();
  const visible = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      <Popover open={open} onOpenChange={setOpen} modal>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="h-9 justify-between gap-2 font-normal"
          >
            {selected.length === 0
              ? "All branches"
              : `${selected.length} branch${selected.length === 1 ? "" : "es"}`}
            <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-0">
          <div className="relative border-b">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              className="h-9 rounded-none border-0 pl-8 shadow-none focus-visible:ring-0"
              placeholder="Search branch…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="max-h-60 overflow-y-auto p-1" role="listbox" aria-multiselectable>
            {locations.isLoading ? (
              <p className="px-2 py-3 text-sm text-muted-foreground">Loading…</p>
            ) : visible.length === 0 ? (
              <p className="px-2 py-3 text-sm text-muted-foreground">No branches found.</p>
            ) : (
              visible.map((o) => {
                const isOn = selected.includes(o.id);
                return (
                  <button
                    key={o.id}
                    type="button"
                    role="option"
                    aria-selected={isOn}
                    onClick={() => toggle(o.id)}
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted"
                  >
                    <Check className={cn("h-4 w-4 shrink-0", isOn ? "opacity-100" : "opacity-0")} />
                    <span className="truncate">{o.label}</span>
                  </button>
                );
              })
            )}
          </div>
          {selected.length > 0 && (
            <div className="border-t p-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full justify-center text-xs"
                onClick={() => onChange([])}
              >
                Clear
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {selected.map((id) => (
        <span
          key={id}
          className="inline-flex max-w-40 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"
        >
          <span className="truncate">{labelOf.get(id) ?? id}</span>
          <button
            type="button"
            aria-label={`Remove ${labelOf.get(id) ?? id}`}
            className="text-muted-foreground hover:text-foreground"
            onClick={() => toggle(id)}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
    </div>
  );
}
