"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/lib/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  usePayslipDetail,
  useSaveAdjustments,
  type AdjustmentInput,
  type PayslipComponent,
} from "@/lib/hooks/usePayrollRuns";

/**
 * The payslip drill-in, ported from the legacy row action in
 * `HRIZ_PayrollGenerated.razor`.
 *
 * Shows the computed lines read-only, then lets you key in ADJUSTMENTS —
 * `pay_amounts` rows flagged `pya_adj = 1`. Computed lines are regenerated on
 * every compute, so only adjustments are editable; everything else would be
 * overwritten.
 *
 * Saving does not recompute. Adjustments change gross and, when taxable, the
 * withholding base, so the dialog tells you to regenerate afterwards.
 */

const peso = (n: number) =>
  n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export interface PayslipDetailDialogProps {
  code: string;
  pk: string | null;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful save so the caller can offer to regenerate. */
  onSaved?: () => void;
}

export function PayslipDetailDialog({
  code,
  pk,
  onOpenChange,
  onSaved,
}: PayslipDetailDialogProps) {
  return (
    <Dialog open={Boolean(pk)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(94vw,900px)] sm:max-w-[min(94vw,900px)]">
        {pk && (
          <PayslipDetailBody
            code={code}
            pk={pk}
            onOpenChange={onOpenChange}
            onSaved={onSaved}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function PayslipDetailBody({
  code,
  pk,
  onOpenChange,
  onSaved,
}: PayslipDetailDialogProps & { pk: string }) {
  const { toast } = useToast();
  const detail = usePayslipDetail(code, pk);
  const save = useSaveAdjustments(code);

  // `null` until loaded, then seeded from the server's adjustment rows.
  const [draft, setDraft] = useState<AdjustmentInput[] | null>(null);

  const data = detail.data;
  const computed = useMemo(
    () => (data?.lines ?? []).filter((l) => !l.isAdjustment),
    [data],
  );
  const serverAdjustments = useMemo<AdjustmentInput[]>(
    () =>
      (data?.lines ?? [])
        .filter((l) => l.isAdjustment)
        .map((l) => ({
          code: l.code,
          type: l.type,
          description: l.description,
          amount: l.amount,
          taxable: l.taxable,
        })),
    [data],
  );
  const rows = draft ?? serverAdjustments;
  const posted = data?.slip.posted ?? false;

  const credits = (data?.components ?? []).filter(
    (c) => (c.cd_type ?? "C").toUpperCase() === "C",
  );
  const deductions = (data?.components ?? []).filter(
    (c) => (c.cd_type ?? "C").toUpperCase() === "D",
  );

  const update = (i: number, patch: Partial<AdjustmentInput>) =>
    setDraft(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const addRow = (type: "C" | "D") => {
    const pool = type === "C" ? credits : deductions;
    const first = pool[0];
    setDraft([
      ...rows,
      {
        code: first?.cd_code ?? "",
        type,
        description: "",
        amount: 0,
        // Default taxability from `comded`, which is the authority on it.
        taxable: first?.cd_tax === 1,
      },
    ]);
  };

  const removeRow = (i: number) => setDraft(rows.filter((_, idx) => idx !== i));

  const totals = useMemo(() => {
    const line = (t: "C" | "D") =>
      computed.filter((l) => l.type === t).reduce((s, l) => s + l.amount, 0);
    const adj = (t: "C" | "D") =>
      rows.filter((r) => r.type === t).reduce((s, r) => s + Math.abs(r.amount), 0);
    const earnings = line("C") + adj("C");
    const taken = line("D") + adj("D");
    return { earnings, taken, net: earnings - taken };
  }, [computed, rows]);

  const handleSave = async () => {
    try {
      await save.mutateAsync({ pk, adjustments: rows });
      toast({
        title: "Adjustments saved",
        description: "Regenerate the run so totals and tax catch up.",
      });
      setDraft(null);
      onSaved?.();
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Could not save adjustments",
        description: e instanceof Error ? e.message : undefined,
      });
    }
  };

  const componentOptions = (type: "C" | "D"): PayslipComponent[] =>
    type === "C" ? credits : deductions;

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {data?.slip.name ?? "Payslip"}
          {data?.slip.employee && (
            <span className="ml-2 font-mono text-sm font-normal text-muted-foreground">
              {data.slip.employee}
            </span>
          )}
        </DialogTitle>
        <DialogDescription>
          Computed lines are read-only — they are rebuilt on every generate. Add
          adjustments below.
        </DialogDescription>
      </DialogHeader>

      {detail.isLoading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading payslip…</p>
      ) : detail.isError ? (
        <p className="py-8 text-center text-sm text-destructive">
          Could not load this payslip.
        </p>
      ) : (
        <div className="max-h-[70vh] space-y-5 overflow-y-auto pr-1">
          {/* -------- computed lines -------- */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Computed
            </h3>
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <tbody>
                  {computed.length === 0 ? (
                    <tr>
                      <td className="px-3 py-4 text-muted-foreground">No computed lines.</td>
                    </tr>
                  ) : (
                    computed.map((l) => (
                      <tr key={`${l.code}-${l.counter}`} className="border-b last:border-0">
                        <td className="px-3 py-1.5">
                          <span
                            className={cn(
                              "mr-2 inline-block w-4 text-center text-xs font-semibold",
                              l.type === "C" ? "text-emerald-500" : "text-muted-foreground",
                            )}
                          >
                            {l.type === "C" ? "+" : "−"}
                          </span>
                          {l.label}
                          {l.description && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              {l.description}
                            </span>
                          )}
                        </td>
                        <td className="w-32 px-3 py-1.5 text-right tabular-nums">
                          {peso(l.amount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* -------- loans -------- */}
          {(data?.loans.length ?? 0) > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Loans collected
              </h3>
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                  <tbody>
                    {data!.loans.map((l) => (
                      <tr key={l.advanceId} className="border-b last:border-0">
                        <td className="px-3 py-1.5 font-mono text-xs">{l.advanceId}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">
                          {peso(l.amount)}
                        </td>
                        <td className="w-40 px-3 py-1.5 text-right text-xs text-muted-foreground">
                          balance {peso(l.balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* -------- adjustments -------- */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Adjustments
              </h3>
              {!posted && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => addRow("C")}>
                    <Plus className="h-3.5 w-3.5" /> Earning
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => addRow("D")}>
                    <Plus className="h-3.5 w-3.5" /> Deduction
                  </Button>
                </div>
              )}
            </div>

            {rows.length === 0 ? (
              <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                No adjustments on this payslip.
              </p>
            ) : (
              <div className="space-y-2">
                {rows.map((r, i) => (
                  <div
                    key={i}
                    className="grid items-center gap-2 rounded-lg border p-2 md:grid-cols-[7rem_minmax(0,1fr)_minmax(0,1fr)_7rem_auto]"
                  >
                    <Select
                      value={r.type}
                      onValueChange={(v) => {
                        const type = v as "C" | "D";
                        const first = componentOptions(type)[0];
                        update(i, {
                          type,
                          code: first?.cd_code ?? "",
                          taxable: first?.cd_tax === 1,
                        });
                      }}
                      disabled={posted}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="C">Earning</SelectItem>
                        <SelectItem value="D">Deduction</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select
                      value={r.code}
                      onValueChange={(v) => {
                        const c = componentOptions(r.type).find((x) => x.cd_code === v);
                        update(i, { code: v, taxable: c?.cd_tax === 1 });
                      }}
                      disabled={posted}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Component" />
                      </SelectTrigger>
                      <SelectContent>
                        {componentOptions(r.type).map((c) => (
                          <SelectItem key={c.cd_code} value={c.cd_code}>
                            {c.cd_desc ?? c.cd_code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Input
                      placeholder="Description"
                      value={r.description}
                      disabled={posted}
                      onChange={(e) => update(i, { description: e.target.value })}
                    />

                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      className="text-right tabular-nums"
                      value={r.amount}
                      disabled={posted}
                      onChange={(e) => update(i, { amount: Number(e.target.value) })}
                    />

                    <div className="flex items-center gap-2">
                      <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
                        <Checkbox
                          checked={r.taxable}
                          disabled={posted}
                          onCheckedChange={(v) => update(i, { taxable: v === true })}
                        />
                        Taxable
                      </label>
                      {!posted && (
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Remove adjustment"
                          onClick={() => removeRow(i)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="rounded-lg border bg-muted/20 px-3 py-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Earnings</span>
              <span className="tabular-nums">{peso(totals.earnings)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Deductions</span>
              <span className="tabular-nums">{peso(totals.taken)}</span>
            </div>
            <div className="mt-1 flex justify-between border-t pt-1 font-medium">
              <span>Net</span>
              <span className="tabular-nums">{peso(totals.net)}</span>
            </div>
          </div>

          {posted ? (
            <p className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              This run is posted, so adjustments are read-only. Unpost it to make
              changes.
            </p>
          ) : (
            <p className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              Saving stores the adjustments but does not recompute. Regenerate the
              run so the register totals and withholding tax pick them up.
            </p>
          )}
        </div>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Close
        </Button>
        {!posted && (
          <Button onClick={handleSave} disabled={save.isPending || detail.isLoading}>
            {save.isPending ? "Saving…" : "Save adjustments"}
          </Button>
        )}
      </DialogFooter>
    </>
  );
}
