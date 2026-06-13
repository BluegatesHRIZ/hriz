"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";
import { useToast } from "@/lib/hooks/use-toast";
import { useMemos, useAddMemo, type EmpMemo } from "@/lib/hooks/useEmployeeDetail";

interface Props { empId: string }

const MEMO_LEVELS = ["Warning", "Final Warning", "Commendation", "Notice", "Other"];
const MEMO_TYPES = ["Written Warning", "Verbal Warning", "Suspension", "Award", "Notice to Explain", "Other"];

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function MemosTab({ empId }: Props) {
  const { toast } = useToast();
  const { data: records = [], isLoading } = useMemos(empId);
  const addMutation = useAddMemo(empId);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Omit<EmpMemo, "emp_mmid" | "emp_mmlogdate">>({
    emp_mmlev: null, emp_mmcode: null, emp_mmtype: null, emp_mmnote: null,
  });

  async function handleAdd() {
    try {
      await addMutation.mutateAsync(form);
      toast({ title: "Added", description: "Memo record added." });
      setForm({ emp_mmlev: null, emp_mmcode: null, emp_mmtype: null, emp_mmnote: null });
      setOpen(false);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    }
  }

  if (isLoading) return <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" />Add Memo</Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Level</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Note</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No memo records found.</TableCell></TableRow>
            ) : records.map((r) => (
              <TableRow key={r.emp_mmid}>
                <TableCell className="whitespace-nowrap">{fmtDate(r.emp_mmlogdate)}</TableCell>
                <TableCell>{r.emp_mmlev ?? "—"}</TableCell>
                <TableCell>{r.emp_mmtype ?? "—"}</TableCell>
                <TableCell>{r.emp_mmcode ?? "—"}</TableCell>
                <TableCell>{r.emp_mmnote ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Memo Record</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="space-y-1">
              <Label>Level</Label>
              <Select onValueChange={(v) => setForm({ ...form, emp_mmlev: v })}>
                <SelectTrigger><SelectValue placeholder="Select level" /></SelectTrigger>
                <SelectContent>{MEMO_LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select onValueChange={(v) => setForm({ ...form, emp_mmtype: v })}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>{MEMO_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Code</Label>
              <Input value={form.emp_mmcode ?? ""} onChange={(e) => setForm({ ...form, emp_mmcode: e.target.value })} placeholder="Memo code" />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Note</Label>
              <Input value={form.emp_mmnote ?? ""} onChange={(e) => setForm({ ...form, emp_mmnote: e.target.value })} placeholder="Remarks / note" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={addMutation.isPending}>{addMutation.isPending ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
