"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import { useToast } from "@/lib/hooks/use-toast";
import { useTrainings, useAddTraining, useDeleteTraining, type EmpTraining } from "@/lib/hooks/useEmployeeDetail";

interface Props { empId: string }

const TRAINING_TYPES = ["In-house", "External", "Online", "Seminar", "Workshop", "Conference", "Other"];

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function TrainingsTab({ empId }: Props) {
  const { toast } = useToast();
  const { data: records = [], isLoading } = useTrainings(empId);
  const addMutation = useAddTraining(empId);
  const deleteMutation = useDeleteTraining(empId);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Omit<EmpTraining, "emp_trid">>({
    emp_trdate: null, emp_trdesc: null, emp_tradd: null, emp_trspeak: null, emp_trtype: null,
  });

  async function handleAdd() {
    if (!form.emp_trdesc) {
      toast({ title: "Validation", description: "Training description is required.", variant: "destructive" });
      return;
    }
    try {
      await addMutation.mutateAsync(form);
      toast({ title: "Added", description: "Training record added." });
      setForm({ emp_trdate: null, emp_trdesc: null, emp_tradd: null, emp_trspeak: null, emp_trtype: null });
      setOpen(false);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    }
  }

  async function handleDelete(trid: string) {
    try {
      await deleteMutation.mutateAsync(trid);
      toast({ title: "Deleted", description: "Training record removed." });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    }
  }

  if (isLoading) return <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" />Add Training</Button>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Speaker / Trainer</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No training records found.</TableCell></TableRow>
            ) : records.map((r) => (
              <TableRow key={r.emp_trid}>
                <TableCell className="whitespace-nowrap">{fmtDate(r.emp_trdate)}</TableCell>
                <TableCell>{r.emp_trdesc ?? "—"}</TableCell>
                <TableCell>{r.emp_trspeak ?? "—"}</TableCell>
                <TableCell>{r.emp_trtype ?? "—"}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(r.emp_trid)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Training / Seminar</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="space-y-1">
              <Label>Date</Label>
              <Input type="date" onChange={(e) => setForm({ ...form, emp_trdate: e.target.value ? new Date(e.target.value) : null })} />
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select onValueChange={(v) => setForm({ ...form, emp_trtype: v })}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>{TRAINING_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Description</Label>
              <Input value={form.emp_trdesc ?? ""} onChange={(e) => setForm({ ...form, emp_trdesc: e.target.value })} placeholder="Training title / description" />
            </div>
            <div className="space-y-1">
              <Label>Speaker / Trainer</Label>
              <Input value={form.emp_trspeak ?? ""} onChange={(e) => setForm({ ...form, emp_trspeak: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Address / Venue</Label>
              <Input value={form.emp_tradd ?? ""} onChange={(e) => setForm({ ...form, emp_tradd: e.target.value })} />
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
