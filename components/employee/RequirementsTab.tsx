"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import { useToast } from "@/lib/hooks/use-toast";
import { useRequirements, useAddRequirement, useDeleteRequirement } from "@/lib/hooks/useEmployeeDetail";

interface Props { empId: string }

export function RequirementsTab({ empId }: Props) {
  const { toast } = useToast();
  const { data: records = [], isLoading } = useRequirements(empId);
  const addMutation = useAddRequirement(empId);
  const deleteMutation = useDeleteRequirement(empId);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ emp_rqname: "", emp_rqnote: "" });

  async function handleAdd() {
    if (!form.emp_rqname) {
      toast({ title: "Validation", description: "Requirement name is required.", variant: "destructive" });
      return;
    }
    try {
      await addMutation.mutateAsync(form);
      toast({ title: "Added", description: "Requirement added." });
      setForm({ emp_rqname: "", emp_rqnote: "" });
      setOpen(false);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    }
  }

  async function handleDelete(rqid: string) {
    try {
      await deleteMutation.mutateAsync(rqid);
      toast({ title: "Deleted", description: "Requirement removed." });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    }
  }

  if (isLoading) return <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" />Add Requirement</Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Requirement</TableHead>
              <TableHead>Note</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.length === 0 ? (
              <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">No requirements found.</TableCell></TableRow>
            ) : records.map((r) => (
              <TableRow key={r.emp_rqid}>
                <TableCell>{r.emp_rqname ?? "—"}</TableCell>
                <TableCell>{r.emp_rqnote ?? "—"}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(r.emp_rqid)}>
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
          <DialogHeader><DialogTitle>Add Requirement / Document</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Requirement Name</Label>
              <Input value={form.emp_rqname} onChange={(e) => setForm({ ...form, emp_rqname: e.target.value })} placeholder="e.g. NBI Clearance, SSS Card" />
            </div>
            <div className="space-y-1">
              <Label>Note</Label>
              <Input value={form.emp_rqnote} onChange={(e) => setForm({ ...form, emp_rqnote: e.target.value })} placeholder="Additional note" />
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
