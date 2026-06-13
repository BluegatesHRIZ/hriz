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
import { useMovements, useAddMovement, type EmpMovement } from "@/lib/hooks/useEmployeeDetail";

interface Props { empId: string }

const MOVEMENT_TYPES = ["Promotion", "Transfer", "Demotion", "Regularization", "Resignation", "Termination", "Rehired"];
const EMP_STATUSES = ["Regular", "Probationary", "Contractual", "Part-time", "Resigned", "Terminated"];

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function MovementTab({ empId }: Props) {
  const { toast } = useToast();
  const { data: records = [], isLoading } = useMovements(empId);
  const addMutation = useAddMovement(empId);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Omit<EmpMovement, "emp_mvid">>({
    emp_mvdate: null, emp_mvposfrm: null, emp_mvposto: null, emp_mvsvisor: null,
    emp_mvdept: null, emp_mvtype: null, emp_mvempstat: null, emp_mvloc: null,
  });

  async function handleAdd() {
    try {
      await addMutation.mutateAsync(form);
      toast({ title: "Added", description: "Movement record added." });
      setForm({ emp_mvdate: null, emp_mvposfrm: null, emp_mvposto: null, emp_mvsvisor: null, emp_mvdept: null, emp_mvtype: null, emp_mvempstat: null, emp_mvloc: null });
      setOpen(false);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    }
  }

  if (isLoading) return <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" />Add Movement</Button>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Position From</TableHead>
              <TableHead>Position To</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Emp Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No movement records found.</TableCell></TableRow>
            ) : records.map((r) => (
              <TableRow key={r.emp_mvid}>
                <TableCell className="whitespace-nowrap">{fmtDate(r.emp_mvdate)}</TableCell>
                <TableCell>{r.emp_mvtype ?? "—"}</TableCell>
                <TableCell>{r.emp_mvposfrm ?? "—"}</TableCell>
                <TableCell>{r.emp_mvposto ?? "—"}</TableCell>
                <TableCell>{r.emp_mvdept ?? "—"}</TableCell>
                <TableCell>{r.emp_mvempstat ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Movement Record</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="space-y-1">
              <Label>Date</Label>
              <Input type="date" onChange={(e) => setForm({ ...form, emp_mvdate: e.target.value ? new Date(e.target.value) : null })} />
            </div>
            <div className="space-y-1">
              <Label>Movement Type</Label>
              <Select onValueChange={(v) => setForm({ ...form, emp_mvtype: v })}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>{MOVEMENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Position From</Label>
              <Input value={form.emp_mvposfrm ?? ""} onChange={(e) => setForm({ ...form, emp_mvposfrm: e.target.value })} placeholder="Position code" />
            </div>
            <div className="space-y-1">
              <Label>Position To</Label>
              <Input value={form.emp_mvposto ?? ""} onChange={(e) => setForm({ ...form, emp_mvposto: e.target.value })} placeholder="Position code" />
            </div>
            <div className="space-y-1">
              <Label>Department</Label>
              <Input value={form.emp_mvdept ?? ""} onChange={(e) => setForm({ ...form, emp_mvdept: e.target.value })} placeholder="Dept code" />
            </div>
            <div className="space-y-1">
              <Label>Employment Status</Label>
              <Select onValueChange={(v) => setForm({ ...form, emp_mvempstat: v })}>
                <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                <SelectContent>{EMP_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Supervisor ID</Label>
              <Input value={form.emp_mvsvisor ?? ""} onChange={(e) => setForm({ ...form, emp_mvsvisor: e.target.value })} placeholder="Emp ID" />
            </div>
            <div className="space-y-1">
              <Label>Location</Label>
              <Input value={form.emp_mvloc ?? ""} onChange={(e) => setForm({ ...form, emp_mvloc: e.target.value })} placeholder="Loc code" />
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
