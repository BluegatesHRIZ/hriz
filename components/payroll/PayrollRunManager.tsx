"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Calculator, Trash2 } from "lucide-react";

import { CardWithHeader } from "@/components/cards/CardWithHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { RunPayrollDialog } from "./RunPayrollDialog";
import { PayComponentsPanel } from "./PayComponentsPanel";
import {
  usePayrollRuns,
  useCreatePayrollRun,
  useComputeRun,
  useDeletePayrollRun,
  RUN_STATUS_LABEL,
  ordinalPeriod,
  type CreateRunInput,
} from "@/lib/hooks/usePayrollRuns";

/**
 * Payroll runs, ported from the legacy Blazor page (`HRIZ_Payroll.razor`).
 *
 * Columns, labels and behaviour follow the original: a payroll-year filter, a
 * grid of runs whose Status is a link (Saved reopens the dialog, anything else
 * drills into the register), and a delete action available only while a run is
 * unposted.
 */

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function monthYear(month: number | null, year: number | null): string {
  if (!month || !year) return "";
  return `${MONTHS[month - 1]} ${year}`;
}

function StatusBadge({ status }: { status: string | null }) {
  const label = RUN_STATUS_LABEL[status ?? ""] ?? "Undefined";
  const variant =
    status === "1" ? "default" : status === "5" ? "outline" : "secondary";
  return <Badge variant={variant}>{label}</Badge>;
}

export function PayrollRunManager() {
  const { toast } = useToast();
  const router = useRouter();

  const [year, setYear] = useState(() => new Date().getFullYear());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const runs = usePayrollRuns(year);
  const createRun = useCreatePayrollRun();
  const computeRun = useComputeRun();
  const deleteRun = useDeletePayrollRun();

  const busy = createRun.isPending || computeRun.isPending;

  const fail = (e: unknown, fallback: string) =>
    toast({
      variant: "destructive",
      title: fallback,
      description: e instanceof Error ? e.message : undefined,
    });

  /**
   * Save parks the header (status 5) without computing. Generate creates it and
   * immediately computes the selected employees, then opens the register.
   */
  const handleSubmit = async (
    input: CreateRunInput,
    employees: string[],
    action: "save" | "generate",
  ) => {
    try {
      const { code } = await createRun.mutateAsync({ ...input, action });

      if (action === "save") {
        toast({ title: `Saved run ${code}`, description: "Generate it when ready." });
        setDialogOpen(false);
        return;
      }

      const res = await computeRun.mutateAsync({ code, employees });
      toast({
        title: `Generated ${res.computed} payslip${res.computed === 1 ? "" : "s"}`,
        description: res.skipped.length
          ? `${res.skipped.length} skipped — no active salary record.`
          : undefined,
      });
      setDialogOpen(false);
      router.push(`/payroll/${code}`);
    } catch (e) {
      fail(e, action === "save" ? "Could not save the run" : "Generate failed");
    }
  };

  const handleDelete = async (code: string) => {
    try {
      await deleteRun.mutateAsync(code);
      toast({ title: `Deleted run ${code}` });
    } catch (e) {
      fail(e, "Delete failed");
    } finally {
      setConfirmDelete(null);
    }
  };

  return (
    <div className="w-full px-4 md:px-6 lg:px-8 pt-5 pb-8 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Payroll</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a payroll period, generate it from attendance, review the
            register, then post.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>Run Payroll</Button>
      </div>

      <CardWithHeader
        title="Payroll Runs"
        icon={<Calculator />}
        headerActions={
          <div className="flex items-end gap-2">
            <Label htmlFor="pr-year" className="pb-2 text-xs text-muted-foreground">
              Payroll year
            </Label>
            <Input
              id="pr-year"
              type="number"
              className="w-24"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            />
          </div>
        }
      >
        {runs.isLoading ? (
          <p className="py-6 text-sm text-muted-foreground">Loading runs…</p>
        ) : runs.isError ? (
          <p className="py-6 text-sm text-destructive">Could not load payroll runs.</p>
        ) : !runs.data?.length ? (
          <p className="py-6 text-sm text-muted-foreground">
            No payroll runs for {year}. Use Run Payroll to create one.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Created By</TableHead>
                  <TableHead>Month &amp; Year</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Run date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.data.map((r) => (
                  <TableRow key={r.code}>
                    <TableCell className="whitespace-nowrap">
                      {r.createdBy ?? "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {monthYear(r.month, r.year)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {ordinalPeriod(r.period)}
                    </TableCell>
                    <TableCell>{r.description ? r.code.slice(0, 2) : ""}</TableCell>
                    <TableCell className="max-w-[24rem] truncate" title={r.description ?? ""}>
                      {r.description}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {r.postedDate ? r.postedDate.slice(0, 10) : r.from}
                    </TableCell>
                    <TableCell>
                      {/* Saved reopens the dialog in the legacy app; here it
                          drills into the register like every other status, since
                          the register is where Generate/Post live. */}
                      <button
                        type="button"
                        className="rounded-sm hover:underline"
                        onClick={() => router.push(`/payroll/${r.code}`)}
                      >
                        <StatusBadge status={r.status} />
                      </button>
                    </TableCell>
                    <TableCell>
                      {r.status !== "1" && (
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Delete run ${r.code}`}
                          onClick={() => setConfirmDelete(r.code)}
                          disabled={deleteRun.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardWithHeader>

      <PayComponentsPanel />

      <RunPayrollDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        saving={busy}
        onSubmit={handleSubmit}
      />

      <AlertDialog
        open={Boolean(confirmDelete)}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete payroll run {confirmDelete}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the run and every payslip computed under it. Posted runs
              cannot be deleted — unpost them first so loan balances and
              year-to-date totals are reversed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && handleDelete(confirmDelete)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
