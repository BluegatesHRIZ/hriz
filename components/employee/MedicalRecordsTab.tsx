"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import { useToast } from "@/lib/hooks/use-toast";
import { useMedicalRecords, useAddMedicalRecord, useDeleteMedicalRecord } from "@/lib/hooks/useEmployeeDetail";

interface Props { empId: string }

export function MedicalRecordsTab({ empId }: Props) {
  const { toast } = useToast();
  const { data: records = [], isLoading } = useMedicalRecords(empId);
  const addMutation = useAddMedicalRecord(empId);
  const deleteMutation = useDeleteMedicalRecord(empId);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ emp_mrfile: "", emp_mrrem: "" });

  async function handleAdd() {
    if (!form.emp_mrfile && !form.emp_mrrem) {
      toast({ title: "Validation", description: "Enter a file reference or remarks.", variant: "destructive" });
      return;
    }
    try {
      await addMutation.mutateAsync(form);
      toast({ title: "Added", description: "Medical record added." });
      setForm({ emp_mrfile: "", emp_mrrem: "" });
      setOpen(false);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    }
  }

  async function handleDelete(mrid: string) {
    try {
      await deleteMutation.mutateAsync(mrid);
      toast({ title: "Deleted", description: "Record removed." });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    }
  }

  if (isLoading) return <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" />Add Record</Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>File Reference</TableHead>
              <TableHead>Remarks</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.length === 0 ? (
              <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">No medical records found.</TableCell></TableRow>
            ) : records.map((r) => (
              <TableRow key={r.emp_mrid}>
                <TableCell>{r.emp_mrfile ?? "—"}</TableCell>
                <TableCell>{r.emp_mrrem ?? "—"}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(r.emp_mrid)}>
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
          <DialogHeader><DialogTitle>Add Medical Record</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>File Reference</Label>
              <Input value={form.emp_mrfile} onChange={(e) => setForm({ ...form, emp_mrfile: e.target.value })} placeholder="e.g. medcert_2024.pdf" />
            </div>
            <div className="space-y-1">
              <Label>Remarks</Label>
              <Input value={form.emp_mrrem} onChange={(e) => setForm({ ...form, emp_mrrem: e.target.value })} placeholder="Remarks" />
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
