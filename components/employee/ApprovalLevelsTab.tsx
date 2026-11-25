"use client";

import { useState } from "react";
import { Plus, Search, UserCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { initialsOf } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useToast } from "@/lib/hooks/use-toast";
import { useEmployees } from "@/lib/hooks/useEmployees";
import {
  useAddApprover,
  useApprovalChain,
  useRemoveApprover,
  useSetSelfApproval,
} from "@/lib/hooks/useEmployeeDetail";
import { MAX_APPROVAL_LEVEL } from "@/lib/requests/approvalModules";
import type { ChainApprover } from "@/lib/types";

interface Props {
  empId: string;
  employeeName: string;
}

/** Every node is the same width so the connector bar meets the parent line at its centre. */
const NODE = "w-48 shrink-0";

/**
 * One child in a row of the tree. Draws the stub up to the shared bar, and the
 * half of the bar on each side (left half hidden on the first child, right half
 * on the last), so the bar runs from the first child's centre to the last's.
 */
function Branch({ children }: { children: React.ReactNode }) {
  return (
    <li
      className={cn(
        "relative flex justify-center px-2 pt-6",
        "before:absolute before:left-0 before:top-0 before:w-1/2 before:border-t before:border-border",
        "after:absolute after:right-0 after:top-0 after:w-1/2 after:border-t after:border-border",
        "first:before:border-t-0 last:after:border-t-0",
      )}
    >
      <span aria-hidden className="absolute left-1/2 top-0 h-6 border-l border-border" />
      {children}
    </li>
  );
}

function Stem() {
  return <span aria-hidden className="mx-auto block h-6 border-l border-border" />;
}

function PersonNode({
  name,
  id,
  tone = "default",
  note,
  onRemove,
}: {
  name: string;
  id: string;
  tone?: "root" | "default";
  note?: string;
  onRemove?: () => void;
}) {
  return (
    <div
      className={cn(
        NODE,
        "group relative flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5 text-left shadow-sm",
        tone === "root" ? "border-primary/60 ring-1 ring-primary/20" : "border-border/70",
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          tone === "root" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
        )}
      >
        {initialsOf(name)}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-foreground" title={name}>
          {name}
        </span>
        <span className="block font-mono text-xs text-muted-foreground">{id}</span>
        {note && <span className="mt-0.5 block text-xs text-amber-600 dark:text-amber-400">{note}</span>}
      </span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${name}`}
          className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm transition hover:text-destructive focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function AddNode({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        NODE,
        "flex min-h-[58px] items-center justify-center gap-2 rounded-xl border border-dashed border-border px-3 text-sm text-muted-foreground transition hover:border-primary hover:text-primary",
      )}
    >
      <Plus className="h-4 w-4" />
      {label}
    </button>
  );
}

function LevelLabel({ level }: { level: number }) {
  return (
    <p className="mb-1 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      Level {level}
    </p>
  );
}

export function ApprovalLevelsTab({ empId, employeeName }: Props) {
  const { toast } = useToast();
  const { data: chain, isLoading } = useApprovalChain(empId);
  const addApprover = useAddApprover(empId);
  const removeApprover = useRemoveApprover(empId);
  const setSelfApproval = useSetSelfApproval(empId);
  const [confirmSelf, setConfirmSelf] = useState(false);

  const [addLevel, setAddLevel] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<{ id: string; name: string } | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{ approver: ChainApprover; level: number } | null>(null);

  const levels = chain?.Levels ?? [];
  // Anyone already in the tree (the employee or an approver at any level) is not offered again.
  const inTree = new Set<string>([empId, ...levels.flatMap((l) => l.Approvers.map((a) => a.ApproverId))]);
  // Ask for a few extra so the list still fills after hiding people already in the tree.
  const results = useEmployees({ search, limit: 8 + inTree.size });
  const candidates = (results.data?.data ?? []).filter((e) => !inTree.has(e.emp_id)).slice(0, 8);
  const nextLevel = (levels.at(-1)?.Level ?? 0) + 1;

  function openAdd(level: number) {
    setAddLevel(level);
    setSearch("");
    setPicked(null);
  }

  async function confirmAdd() {
    if (addLevel == null || !picked) return;
    try {
      const res = await addApprover.mutateAsync({ ApproverId: picked.id, Level: addLevel });
      toast({ title: res.message });
      setAddLevel(null);
    } catch (err) {
      toast({
        title: "Could not add approver",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  }

  async function confirmRemove() {
    if (!removeTarget) return;
    try {
      await removeApprover.mutateAsync({
        approverId: removeTarget.approver.ApproverId,
        level: removeTarget.level,
      });
      toast({ title: "Approver removed" });
    } catch (err) {
      toast({
        title: "Could not remove approver",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setRemoveTarget(null);
    }
  }

  async function applySelfApproval() {
    try {
      const res = await setSelfApproval.mutateAsync();
      toast({ title: res.message });
    } catch (err) {
      toast({
        title: "Could not set N/A",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setConfirmSelf(false);
    }
  }

  const selfApproved = chain?.SelfApproved ?? false;

  if (isLoading) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Loading...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">Approval chain</h3>
          <p className="text-sm text-muted-foreground">
            Requests this employee files go to Level 1 first, then to the next level. Approvers
            handle every request type.
          </p>
        </div>
        {!selfApproved && levels.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirmSelf(true)}
            disabled={setSelfApproval.isPending}
          >
            <UserCheck className="mr-2 h-4 w-4" />
            Set as N/A (approves own)
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border/60 bg-card/40 px-4 py-8">
        <div className="mx-auto flex w-max min-w-full flex-col items-center">
          <p className="mb-1 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Requests from
          </p>
          <PersonNode name={employeeName} id={empId} tone="root" />

          {selfApproved && (
            <div className="flex flex-col items-center">
              <Stem />
              <div
                className={cn(
                  NODE,
                  "rounded-xl border border-emerald-500/50 bg-emerald-500/10 px-3 py-3 text-center",
                )}
              >
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">N/A</p>
                <p className="text-xs text-muted-foreground">Approves their own requests</p>
              </div>
              <Button
                variant="link"
                size="sm"
                className="mt-2"
                onClick={() => openAdd(1)}
              >
                Assign an approver instead
              </Button>
            </div>
          )}

          {!selfApproved && levels.length === 0 && (
            <div className="flex flex-col items-center">
              <Stem />
              <p className="mb-1 max-w-sm text-center text-xs text-amber-600 dark:text-amber-400">
                No approver yet, so requests this employee files reach no one. Pick one:
              </p>
              <Stem />
              <ul className="flex">
                <Branch>
                  <AddNode label="Add Level 1 approver" onClick={() => openAdd(1)} />
                </Branch>
                <Branch>
                  <button
                    type="button"
                    onClick={applySelfApproval}
                    disabled={setSelfApproval.isPending}
                    className={cn(
                      NODE,
                      "flex min-h-[58px] flex-col items-center justify-center rounded-xl border border-dashed border-emerald-500/50 px-3 text-sm text-emerald-700 transition hover:bg-emerald-500/10 dark:text-emerald-300",
                    )}
                  >
                    <span className="font-medium">N/A</span>
                    <span className="text-xs text-muted-foreground">Approves own requests</span>
                  </button>
                </Branch>
              </ul>
            </div>
          )}

          {!selfApproved && levels.map(({ Level, Approvers }) => (
            <div key={Level} className="flex flex-col items-center">
              <Stem />
              <LevelLabel level={Level} />
              <Stem />
              <ul className="flex">
                {Approvers.map((a) => (
                  <Branch key={a.ApproverId}>
                    <PersonNode
                      name={a.ApproverName ?? "Unknown employee"}
                      id={a.ApproverId}
                      note={a.CoversAllTypes ? undefined : `Not set for ${a.MissingTypes.join(", ")}`}
                      onRemove={() => setRemoveTarget({ approver: a, level: Level })}
                    />
                  </Branch>
                ))}
                <Branch>
                  <AddNode label={`Add to Level ${Level}`} onClick={() => openAdd(Level)} />
                </Branch>
              </ul>
            </div>
          ))}

          {!selfApproved && levels.length > 0 && nextLevel <= MAX_APPROVAL_LEVEL && (
            <div className="flex flex-col items-center">
              <Stem />
              <AddNode label={`Add Level ${nextLevel}`} onClick={() => openAdd(nextLevel)} />
            </div>
          )}
        </div>
      </div>

      <Dialog open={addLevel != null} onOpenChange={(open) => !open && setAddLevel(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add approver to Level {addLevel}</DialogTitle>
            <DialogDescription>
              They will approve every request type {employeeName} files.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or employee ID"
                className="pl-9"
              />
            </div>
            <ul className="max-h-64 space-y-1 overflow-y-auto">
              {results.isLoading ? (
                <li className="py-4 text-center text-sm text-muted-foreground">Searching...</li>
              ) : candidates.length === 0 ? (
                <li className="py-4 text-center text-sm text-muted-foreground">
                  No employees found who are not already in the chain.
                </li>
              ) : (
                candidates.map((e) => {
                  const name = [e.emp_last, e.emp_first].filter(Boolean).join(", ") || e.emp_id;
                  const selected = picked?.id === e.emp_id;
                  return (
                    <li key={e.emp_id}>
                      <button
                        type="button"
                        onClick={() => setPicked({ id: e.emp_id, name })}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition",
                          selected ? "border-primary bg-primary/10" : "border-transparent hover:bg-muted",
                        )}
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                          {initialsOf(name)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{name}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            <span className="font-mono">{e.emp_id}</span>
                            {e.emp_pos_desc ? ` · ${e.emp_pos_desc}` : ""}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddLevel(null)}>
              Cancel
            </Button>
            <Button onClick={confirmAdd} disabled={!picked || addApprover.isPending}>
              {addApprover.isPending ? "Adding..." : picked ? `Add ${picked.name}` : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmSelf} onOpenChange={setConfirmSelf}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Set {employeeName} as N/A?</AlertDialogTitle>
            <AlertDialogDescription>
              Their current approvers are removed and their requests will come back to them to
              approve. Use this for the CEO or anyone with no one above them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={applySelfApproval}>Set as N/A</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!removeTarget} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove approver?</AlertDialogTitle>
            <AlertDialogDescription>
              {removeTarget?.approver.ApproverName ?? removeTarget?.approver.ApproverId} will stop
              receiving requests from {employeeName} at Level {removeTarget?.level}. Requests already
              waiting for them are not changed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmRemove}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
