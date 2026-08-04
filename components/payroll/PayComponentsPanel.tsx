"use client";

import { useMemo, useState } from "react";
import { Receipt, Save } from "lucide-react";

import { CardWithHeader } from "@/components/cards/CardWithHeader";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/lib/hooks/use-toast";
import {
  usePayComponents,
  useUpdatePayComponents,
  type PayComponentRule,
} from "@/lib/hooks/usePayrollRuns";

/**
 * The taxable checkbox, per pay component.
 *
 * `comded.cd_tax` decides what enters the BIR withholding base. It applies to
 * deductions as well as earnings, and means "does this line participate in
 * taxable income" — absences and statutory contributions reduce the base,
 * loan repayments and coop deductions do not.
 *
 * Changing a box affects FUTURE computes only. Posted runs keep the amounts
 * they were computed with; a draft run picks up the change when recomputed.
 */
export function PayComponentsPanel() {
  const { toast } = useToast();
  const { data, isLoading, isError } = usePayComponents();
  const update = useUpdatePayComponents();

  // Local edits, keyed by code, applied on Save and cleared once persisted.
  const [draft, setDraft] = useState<Record<string, boolean>>({});

  const { credits, deductions } = useMemo(() => {
    const rows = data ?? [];
    const byOrd = (a: PayComponentRule, b: PayComponentRule) =>
      (a.cd_ord ?? 0) - (b.cd_ord ?? 0) || a.cd_code.localeCompare(b.cd_code);
    return {
      credits: rows.filter((r) => (r.cd_type ?? "C").toUpperCase() === "C").sort(byOrd),
      deductions: rows.filter((r) => (r.cd_type ?? "C").toUpperCase() === "D").sort(byOrd),
    };
  }, [data]);

  const isTaxable = (row: PayComponentRule) => draft[row.cd_code] ?? row.cd_tax === 1;

  const dirty = useMemo(
    () =>
      (data ?? []).filter(
        (r) => draft[r.cd_code] !== undefined && draft[r.cd_code] !== (r.cd_tax === 1),
      ),
    [data, draft],
  );

  const handleSave = async () => {
    try {
      await update.mutateAsync(
        dirty.map((r) => ({ code: r.cd_code, taxable: draft[r.cd_code] })),
      );
      toast({
        title: `Updated ${dirty.length} component${dirty.length === 1 ? "" : "s"}`,
        description: "Recompute any draft run to apply the change.",
      });
      setDraft({});
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Could not update pay components",
        description: e instanceof Error ? e.message : undefined,
      });
    }
  };

  const renderGroup = (title: string, rows: PayComponentRule[], hint: string) => (
    <div>
      <div className="mb-1 flex items-baseline gap-2">
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </div>
      <ul className="divide-y rounded-lg border">
        {rows.map((row) => {
          const checked = isTaxable(row);
          const changed = draft[row.cd_code] !== undefined && checked !== (row.cd_tax === 1);
          return (
            <li
              key={row.cd_code}
              className="flex items-center gap-3 px-3 py-2 text-sm"
            >
              <Checkbox
                id={`tax-${row.cd_code}`}
                checked={checked}
                onCheckedChange={(v) =>
                  setDraft((d) => ({ ...d, [row.cd_code]: v === true }))
                }
              />
              <label
                htmlFor={`tax-${row.cd_code}`}
                className="flex-1 cursor-pointer select-none"
              >
                {row.cd_desc || row.cd_code}
                <span className="ml-2 text-xs text-muted-foreground">{row.cd_code}</span>
              </label>
              {changed && <Badge variant="secondary">changed</Badge>}
            </li>
          );
        })}
      </ul>
    </div>
  );

  return (
    <CardWithHeader
      title="Taxable Pay Components"
      icon={<Receipt />}
      headerActions={
        <Button
          size="sm"
          onClick={handleSave}
          disabled={dirty.length === 0 || update.isPending}
        >
          <Save className="h-4 w-4" />
          {update.isPending ? "Saving…" : `Save${dirty.length ? ` (${dirty.length})` : ""}`}
        </Button>
      }
    >
      <p className="mb-4 text-sm text-muted-foreground">
        Ticked components enter the withholding base:{" "}
        <span className="font-medium text-foreground">
          taxable earnings − taxable deductions
        </span>
        . Changes apply to future computes — posted runs keep the amounts they were
        computed with.
      </p>

      {isLoading ? (
        <p className="py-6 text-sm text-muted-foreground">Loading components…</p>
      ) : isError ? (
        <p className="py-6 text-sm text-destructive">Could not load pay components.</p>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {renderGroup("Earnings", credits, "ticked = added to the base")}
          {renderGroup("Deductions", deductions, "ticked = subtracted from the base")}
        </div>
      )}
    </CardWithHeader>
  );
}
