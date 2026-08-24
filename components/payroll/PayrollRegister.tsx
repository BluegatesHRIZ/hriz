"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Calculator,
  ChevronRight,
  PlayCircle,
  Undo2,
} from "lucide-react";

import { CardWithHeader } from "@/components/cards/CardWithHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/Pagination";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/lib/hooks/use-toast";
import { cn } from "@/lib/utils";
import { PayslipDetailDialog } from "./PayslipDetailDialog";
import {
  usePayrollRun,
  useComputeRun,
  usePostRun,
  useUnpostRun,
  RUN_STATUS_LABEL,
  type PayrollSlip,
} from "@/lib/hooks/usePayrollRuns";

/**
 * The generated payroll register, ported from the legacy Blazor page
 * (`HRIZ_PayrollGenerated.razor`). Clicking a row drills into that payslip to
 * key in adjustments.
 *
 * LAYOUT NOTE — the employee column is the only sticky one. An earlier version
 * froze Id, Employee AND Net Pay, which overlapped when scrolled: `position:
 * sticky` on `<td>` needs `border-separate`, and the frozen offsets were
 * hardcoded guesses at column widths that did not match what rendered. Folding
 * the id into a single sticky column removes the offset arithmetic entirely, and
 * Net Pay is emphasised with a divider instead of being frozen.
 */

const peso = (n: number) =>
  n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Rows rendered at a time. Paging is client-side: the run endpoint already
 * returns every slip in one payload (the totals row and the header figures both
 * need the whole run), so paging here is purely about not rendering hundreds of
 * wide rows at once.
 */
const PAGE_SIZE = 25;

/** Numeric columns, in the legacy order, grouped for visual separation. */
const GROUPS: Array<{
  label: string;
  columns: Array<{ key: keyof PayrollSlip & string; label: string }>;
}> = [
  {
    label: "Earnings",
    columns: [
      { key: "basic", label: "Salary" },
      { key: "premiums", label: "Earnings" },
      { key: "otherEarnings", label: "Other" },
      { key: "netEarnings", label: "Net Earnings" },
    ],
  },
  {
    label: "Deductions",
    columns: [
      { key: "timeDeductions", label: "Absent/Late" },
      { key: "tax", label: "TAX" },
      { key: "sss", label: "SSS" },
      { key: "phic", label: "PHIC" },
      { key: "hdmf", label: "HDMF" },
      { key: "loans", label: "Loans" },
      { key: "otherDeductions", label: "Other" },
    ],
  },
];

/** Zeros are dimmed so the figures that matter stand out. */
function Amount({ value }: { value: number }) {
  return (
    <span className={cn("tabular-nums", value === 0 && "text-muted-foreground/50")}>
      {peso(value)}
    </span>
  );
}

export function PayrollRegister({ code }: { code: string }) {
  const { toast } = useToast();
  const detail = usePayrollRun(code);
  const computeRun = useComputeRun();
  const postRun = usePostRun();
  const unpostRun = useUnpostRun();

  const [confirm, setConfirm] = useState<"post" | "unpost" | null>(null);
  const [openSlip, setOpenSlip] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const run = detail.data?.run;
  const slips = detail.data?.slips ?? [];
  const totals = detail.data?.totals;
  const isPosted = run?.status === "1";

  // Clamped rather than reset in an effect — a regenerate that shrinks the run
  // would otherwise leave `page` pointing past the end for one render.
  const pageCount = Math.max(1, Math.ceil(slips.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const visible = useMemo(
    () => slips.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE),
    [slips, current],
  );

  const fail = (e: unknown, fallback: string) =>
    toast({
      variant: "destructive",
      title: fallback,
      description: e instanceof Error ? e.message : undefined,
    });

  const handleGenerate = async () => {
    try {
      // No employee list — reuse whoever this run already covers.
      const res = await computeRun.mutateAsync({ code });
      toast({
        title: `Generated ${res.computed} payslip${res.computed === 1 ? "" : "s"}`,
        description: res.skipped.length
          ? `${res.skipped.length} skipped — no active salary record.`
          : undefined,
      });
    } catch (e) {
      fail(e, "Generate failed");
    }
  };

  const handlePost = async () => {
    try {
      await postRun.mutateAsync(code);
      toast({ title: `Run ${code} posted` });
    } catch (e) {
      fail(e, "Post failed");
    } finally {
      setConfirm(null);
    }
  };

  const handleUnpost = async () => {
    try {
      await unpostRun.mutateAsync(code);
      toast({ title: `Run ${code} returned to unposted` });
    } catch (e) {
      fail(e, "Unpost failed");
    } finally {
      setConfirm(null);
    }
  };

  const columnTotal = (key: keyof PayrollSlip & string) =>
    slips.reduce((sum, s) => sum + (s[key] as number), 0);

  return (
    <div className="w-full px-4 md:px-6 lg:px-8 pt-5 pb-8 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            href="/payroll"
            className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Payroll
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-foreground">Generated Payroll</h1>
            <Badge variant={isPosted ? "default" : "secondary"}>
              {RUN_STATUS_LABEL[run?.status ?? ""] ?? "Undefined"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="font-mono text-xs">{code}</span>
            {run?.description ? ` · ${run.description}` : ""}
            {run?.from && run?.to ? ` · ${run.from} → ${run.to}` : ""}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isPosted ? (
            <Button
              variant="outline"
              onClick={() => setConfirm("unpost")}
              disabled={unpostRun.isPending}
            >
              <Undo2 className="h-4 w-4" /> Unpost
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={handleGenerate}
                disabled={computeRun.isPending}
              >
                <Calculator className="h-4 w-4" />
                {computeRun.isPending ? "Generating…" : "Regenerate"}
              </Button>
              <Button
                onClick={() => setConfirm("post")}
                disabled={slips.length === 0 || postRun.isPending}
              >
                <PlayCircle className="h-4 w-4" /> Post
              </Button>
            </>
          )}
        </div>
      </div>

      <CardWithHeader
        title="Register"
        icon={<Calculator />}
        headerActions={
          totals && slips.length > 0 ? (
            <div className="flex items-center gap-4 text-sm">
              <span className="text-muted-foreground">
                Gross <span className="tabular-nums text-foreground">{peso(totals.gross)}</span>
              </span>
              <span className="text-muted-foreground">
                Deductions{" "}
                <span className="tabular-nums text-foreground">{peso(totals.deductions)}</span>
              </span>
              <span className="font-medium">
                Net <span className="tabular-nums">{peso(totals.net)}</span>
              </span>
            </div>
          ) : undefined
        }
      >
        {detail.isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading register…</p>
        ) : detail.isError ? (
          <p className="py-8 text-center text-sm text-destructive">
            Could not load this payroll run.
          </p>
        ) : slips.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No payslips yet — use Regenerate to compute this period.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border">
              {/* border-separate is required for sticky cells to keep their
                  borders; border-collapse drops them mid-scroll. */}
              <table className="w-full border-separate border-spacing-0 text-sm">
                <thead>
                  <tr>
                    <th
                      rowSpan={2}
                      className="sticky left-0 z-20 min-w-[13rem] border-b bg-muted/60 px-3 py-2 text-left align-bottom text-xs font-semibold uppercase tracking-wide text-muted-foreground shadow-[1px_0_0_0_hsl(var(--border))] backdrop-blur"
                    >
                      Employee
                    </th>
                    {GROUPS.map((g) => (
                      <th
                        key={g.label}
                        colSpan={g.columns.length}
                        className="border-b border-l bg-muted/40 px-3 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                      >
                        {g.label}
                      </th>
                    ))}
                    <th
                      rowSpan={2}
                      className="border-b border-l-2 bg-muted/60 px-3 py-2 text-right align-bottom text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      Net Pay
                    </th>
                    <th rowSpan={2} className="w-8 border-b bg-muted/60" />
                  </tr>
                  <tr>
                    {GROUPS.flatMap((g, gi) =>
                      g.columns.map((c, ci) => (
                        <th
                          key={c.key}
                          className={cn(
                            "whitespace-nowrap border-b bg-muted/40 px-3 py-1.5 text-right text-xs font-medium text-muted-foreground",
                            ci === 0 && gi > 0 && "border-l",
                            ci === 0 && gi === 0 && "border-l",
                          )}
                        >
                          {c.label}
                        </th>
                      )),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((s) => (
                    <tr
                      key={s.pk}
                      onClick={() => setOpenSlip(s.pk)}
                      className="group cursor-pointer"
                    >
                      <td className="sticky left-0 z-10 border-b bg-background px-3 py-2 shadow-[1px_0_0_0_hsl(var(--border))] group-hover:bg-muted/40">
                        <div className="font-medium leading-tight">{s.name}</div>
                        <div className="font-mono text-[11px] text-muted-foreground">
                          {s.employee}
                        </div>
                      </td>
                      {GROUPS.flatMap((g) =>
                        g.columns.map((c, ci) => (
                          <td
                            key={c.key}
                            className={cn(
                              "whitespace-nowrap border-b px-3 py-2 text-right group-hover:bg-muted/40",
                              ci === 0 && "border-l",
                            )}
                          >
                            <Amount value={s[c.key] as number} />
                          </td>
                        )),
                      )}
                      <td className="whitespace-nowrap border-b border-l-2 px-3 py-2 text-right font-semibold group-hover:bg-muted/40">
                        <span className="tabular-nums">{peso(s.net)}</span>
                      </td>
                      <td className="border-b px-1 text-right group-hover:bg-muted/40">
                        <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-foreground" />
                      </td>
                    </tr>
                  ))}

                  <tr className="font-semibold">
                    {/* Whole-run totals, not the visible page — they have to
                        agree with the Gross/Net figures in the card header. */}
                    <td className="sticky left-0 z-10 whitespace-nowrap bg-muted/30 px-3 py-2.5 shadow-[1px_0_0_0_hsl(var(--border))]">
                      Total (all {slips.length})
                    </td>
                    {GROUPS.flatMap((g) =>
                      g.columns.map((c, ci) => (
                        <td
                          key={c.key}
                          className={cn(
                            "whitespace-nowrap bg-muted/30 px-3 py-2.5 text-right",
                            ci === 0 && "border-l",
                          )}
                        >
                          <Amount value={columnTotal(c.key)} />
                        </td>
                      )),
                    )}
                    <td className="whitespace-nowrap border-l-2 bg-muted/30 px-3 py-2.5 text-right">
                      <span className="tabular-nums">{peso(totals?.net ?? 0)}</span>
                    </td>
                    <td className="bg-muted/30" />
                  </tr>
                </tbody>
              </table>
            </div>

            <Pagination
              meta={{
                total: slips.length,
                page: current,
                limit: PAGE_SIZE,
                pageCount,
              }}
              onPageChange={setPage}
            />

            <p className="mt-3 text-xs text-muted-foreground">
              Click a row to view its lines and key in adjustments.
              {isPosted && run?.postedBy ? ` · Posted by ${run.postedBy}.` : ""}
            </p>
          </>
        )}
      </CardWithHeader>

      <PayslipDetailDialog
        code={code}
        pk={openSlip}
        onOpenChange={(open) => !open && setOpenSlip(null)}
        onSaved={() => {
          toast({
            title: "Regenerate to apply",
            description: "Adjustments are saved but totals need a regenerate.",
          });
        }}
      />

      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === "post"
                ? `Post payroll run ${code}?`
                : `Unpost payroll run ${code}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "post"
                ? "Posting finalises the register, advances every loan balance and updates year-to-date totals. It can be reversed with Unpost, but review the figures first."
                : "This reverses the loan balances and year-to-date totals this run applied, and returns it to unposted so it can be regenerated."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirm === "post" ? handlePost : handleUnpost}>
              {confirm === "post" ? "Post" : "Unpost"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
