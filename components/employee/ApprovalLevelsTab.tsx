"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";
import { useToast } from "@/lib/hooks/use-toast";
import { useApprovalLevels, useAddApprovalLevel, useDeleteApprovalLevel } from "@/lib/hooks/useEmployeeDetail";

interface Props { empId: string }

const MODULES = [
  { value: "L001", label: "Leave" },
  { value: "OT01", label: "Overtime" },
  { value: "UT01", label: "Undertime" },
  { value: "CA01", label: "COA" },
  { value: "SC01", label: "Schedule Adjustment" },
  { value: "LN01", label: "Loan" },
];

export function ApprovalLevelsTab({ empId }: Props) {
  const { toast } = useToast();
  const { data: records = [], isLoading } = useApprovalLevels(empId);
  const addMutation = useAddApprovalLevel(empId);
  const deleteMutation = useDeleteApprovalLevel(empId);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ al_appvr: "", al_menu: "", al_level: 1 });

  async function handleAdd() {
    if (!form.al_appvr || !form.al_menu) {
      toast({ title: "Validation", description: "Approver ID and module are required.", variant: "destructive" });
      return;
    }
    try {
      await addMutation.mutateAsync(form);
      toast({ title: "Added", description: "Approval level added." });
      setForm({ al_appvr: "", al_menu: "", al_level: 1 });
      setOpen(false);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    }
  }

  async function handleDelete(alId: string) {
    try {
      await deleteMutation.mutateAsync(alId);
      toast({ title: "Deleted", description: "Approval level removed." });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    }
  }

  const moduleLabel = (code: string | null) => MODULES.find((m) => m.value === code)?.label ?? code ?? "—";

  if (isLoading) return <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" />Add Approver</Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Level</TableHead>
              <TableHead>Module</TableHead>
              <TableHead>Approver ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No approval levels configured.</TableCell></TableRow>
            ) : records.map((r) => (
              <TableRow key={r.al_id}>
                <TableCell><Badge variant="outline">Level {r.al_level}</Badge></TableCell>
                <TableCell>{moduleLabel(r.al_menu)}</TableCell>
                <TableCell className="font-mono">{r.al_appvr ?? "—"}</TableCell>
                <TableCell><Badge variant={r.al_stat === 1 ? "default" : "secondary"}>{r.al_stat === 1 ? "Active" : "Inactive"}</Badge></TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(r.al_id)}>
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
          <DialogHeader><DialogTitle>Add Approval Level</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="space-y-1">
              <Label>Approver Employee ID</Label>
              <Input value={form.al_appvr} onChange={(e) => setForm({ ...form, al_appvr: e.target.value })} placeholder="e.g. E00001" />
            </div>
            <div className="space-y-1">
              <Label>Level</Label>
              <Select value={String(form.al_level)} onValueChange={(v) => setForm({ ...form, al_level: parseInt(v) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((l) => <SelectItem key={l} value={String(l)}>Level {l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Module</Label>
              <Select onValueChange={(v) => setForm({ ...form, al_menu: v })}>
                <SelectTrigger><SelectValue placeholder="Select module" /></SelectTrigger>
                <SelectContent>{MODULES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
              </Select>
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
