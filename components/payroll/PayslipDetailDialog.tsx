"use client";

import { useMemo, useRef, useState } from "react";
import { Check, Pencil, Plus, Trash2, TriangleAlert } from "lucide-react";

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

/** A draft row carries a client-side id so edit state survives reordering. */
type DraftRow = AdjustmentInput & { id: string };

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

  // `null` until touched, then seeded from the server's adjustment rows.
  const [draft, setDraft] = useState<DraftRow[] | null>(null);
  // Rows currently shown as a form. Saved rows start collapsed like a line item.
  const [editing, setEditing] = useState<Set<string>>(new Set());
  const nextId = useRef(0);

  const data = detail.data;
  const computed = useMemo(
    () => (data?.lines ?? []).filter((l) => !l.isAdjustment),
    [data],
  );
  const serverAdjustments = useMemo<DraftRow[]>(
    () =>
      (data?.lines ?? [])
        .filter((l) => l.isAdjustment)
        .map((l, i) => ({
          id: `saved-${i}`,
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

  const update = (id: string, patch: Partial<AdjustmentInput>) =>
    setDraft(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const addRow = (type: "C" | "D") => {
    const pool = type === "C" ? credits : deductions;
    const first = pool[0];
    const id = `new-${nextId.current++}`;
    setDraft([
      ...rows,
      {
        id,
        code: first?.cd_code ?? "",
        type,
        description: "",
        amount: 0,
        // Default taxability from `comded`, which is the authority on it.
        taxable: first?.cd_tax === 1,
      },
    ]);
    setEditing(new Set(editing).add(id));
  };

  const removeRow = (id: string) => {
    setDraft(rows.filter((r) => r.id !== id));
    toggleEdit(id, false);
  };

  const toggleEdit = (id: string, on: boolean) => {
    const next = new Set(editing);
    if (on) next.add(id);
    else next.delete(id);
    setEditing(next);
  };

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
      await save.mutateAsync({
        pk,
        adjustments: rows.map(({ id: _id, ...r }) => r),
      });
      toast({
        title: "Adjustments saved",
        description: "Regenerate the run so totals and tax catch up.",
      });
      setDraft(null);
      setEditing(new Set());
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

  const labelFor = (r: DraftRow) =>
    componentOptions(r.type).find((c) => c.cd_code === r.code)?.cd_desc ??
    r.code ??
    "Adjustment";

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
          {/* -------- earnings | deductions, side by side -------- */}
          <div className="grid gap-4 md:grid-cols-2">
            {(["C", "D"] as const).map((type) => {
              const isEarning = type === "C";
              const lines = computed.filter((l) => l.type === type);
              const adjRows = rows.filter((r) => r.type === type);
              const subtotal = isEarning ? totals.earnings : totals.taken;

              return (
                <section
                  key={type}
                  className="flex flex-col overflow-hidden rounded-lg border"
                >
                  <header
                    className={cn(
                      "flex items-baseline justify-between border-b px-3 py-2",
                      isEarning ? "bg-emerald-500/5" : "bg-muted/30",
                    )}
                  >
                    <h3
                      className={cn(
                        "text-xs font-semibold uppercase tracking-wide",
                        isEarning
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-muted-foreground",
                      )}
                    >
                      {isEarning ? "Earnings" : "Deductions"}
                    </h3>
                    <span className="text-sm font-medium tabular-nums">
                      {peso(subtotal)}
                    </span>
                  </header>

                  <div className="divide-y">
                    {/* computed lines — read-only */}
                    {lines.length === 0 && adjRows.length === 0 ? (
                      <p className="px-3 py-3 text-sm text-muted-foreground">
                        No {isEarning ? "earnings" : "deductions"} yet.
                      </p>
                    ) : (
                      lines.map((l) => (
                        <div
                          key={`${l.code}-${l.counter}`}
                          className="flex items-center gap-2 px-3 py-1.5 text-sm"
                        >
                          <span className="min-w-0 flex-1 truncate">
                            {l.label}
                            {l.description && (
                              <span className="ml-2 text-xs text-muted-foreground">
                                {l.description}
                              </span>
                            )}
                          </span>
                          <span className="tabular-nums">{peso(l.amount)}</span>
                        </div>
                      ))
                    )}

                    {/* adjustments — same line shape, flagged and editable */}
                    {adjRows.map((r) =>
                      editing.has(r.id) ? (
                        <div key={r.id} className="space-y-2 bg-muted/20 p-2">
                          <Select
                            value={r.code}
                            onValueChange={(v) => {
                              const c = componentOptions(type).find(
                                (x) => x.cd_code === v,
                              );
                              update(r.id, { code: v, taxable: c?.cd_tax === 1 });
                            }}
                            disabled={posted}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Component" />
                            </SelectTrigger>
                            <SelectContent>
                              {componentOptions(type).map((c) => (
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
                            onChange={(e) =>
                              update(r.id, { description: e.target.value })
                            }
                          />

                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              className="flex-1 text-right tabular-nums"
                              value={r.amount}
                              disabled={posted}
                              onChange={(e) =>
                                update(r.id, { amount: Number(e.target.value) })
                              }
                            />
                            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
                              <Checkbox
                                checked={r.taxable}
                                disabled={posted}
                                onCheckedChange={(v) =>
                                  update(r.id, { taxable: v === true })
                                }
                              />
                              Taxable
                            </label>
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label="Done editing"
                              onClick={() => toggleEdit(r.id, false)}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label="Remove adjustment"
                              onClick={() => removeRow(r.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div
                          key={r.id}
                          className="group flex items-center gap-2 px-3 py-1.5 text-sm"
                        >
                          <span className="min-w-0 flex-1 truncate">
                            {labelFor(r)}
                            {r.description && (
                              <span className="ml-2 text-xs text-muted-foreground">
                                {r.description}
                              </span>
                            )}
                          </span>
                          <span
                            className="rounded border border-sky-500/40 px-1 text-[10px] font-semibold uppercase tracking-wide text-sky-500"
                            title="Adjustment — editable, not recomputed"
                          >
                            Adj
                          </span>
                          <span className="tabular-nums">{peso(r.amount)}</span>
                          {!posted && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 opacity-40 group-hover:opacity-100"
                              aria-label="Edit adjustment"
                              onClick={() => toggleEdit(r.id, true)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      ),
                    )}
                  </div>

                  {!posted && (
                    <div className="mt-auto border-t p-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="w-full justify-center text-muted-foreground"
                        onClick={() => addRow(type)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add {isEarning ? "earning" : "deduction"}
                      </Button>
                    </div>
                  )}
                </section>
              );
            })}
          </div>

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
