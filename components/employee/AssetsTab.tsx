"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/lib/hooks/use-toast";
import { useAssets, useAddAsset, useUpdateAsset, useDeleteAsset, type EmpAsset } from "@/lib/hooks/useEmployeeDetail";

interface Props { empId: string }

const EMPTY: Omit<EmpAsset, "emp_asid"> = { emp_asitem: "", emp_assn: "", emp_asissue: null, emp_asreturn: null, emp_ascond: "" };

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function AssetsTab({ empId }: Props) {
  const { toast } = useToast();
  const { data: assets = [], isLoading } = useAssets(empId);
  const addMutation = useAddAsset(empId);
  const updateMutation = useUpdateAsset(empId);
  const deleteMutation = useDeleteAsset(empId);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EmpAsset | null>(null);
  const [form, setForm] = useState<typeof EMPTY>(EMPTY);

  function openAdd() { setEditing(null); setForm(EMPTY); setOpen(true); }
  function openEdit(a: EmpAsset) {
    setEditing(a);
    setForm({ emp_asitem: a.emp_asitem, emp_assn: a.emp_assn, emp_asissue: a.emp_asissue, emp_asreturn: a.emp_asreturn, emp_ascond: a.emp_ascond });
    setOpen(true);
  }

  async function handleSave() {
    try {
      if (editing) {
        await updateMutation.mutateAsync({ ...form, emp_asid: editing.emp_asid });
      } else {
        await addMutation.mutateAsync(form);
      }
      toast({ title: editing ? "Updated" : "Added", description: "Asset saved." });
      setOpen(false);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    }
  }

  async function handleDelete(asid: string) {
    try {
      await deleteMutation.mutateAsync(asid);
      toast({ title: "Deleted", description: "Asset removed." });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    }
  }

  const isPending = addMutation.isPending || updateMutation.isPending;

  if (isLoading) return <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={openAdd}><Plus className="mr-1 h-4 w-4" />Add Asset</Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Serial No.</TableHead>
              <TableHead>Issued</TableHead>
              <TableHead>Returned</TableHead>
              <TableHead>Condition</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assets.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No assets found.</TableCell></TableRow>
            ) : assets.map((a) => (
              <TableRow key={a.emp_asid}>
                <TableCell>{a.emp_asitem ?? "—"}</TableCell>
                <TableCell>{a.emp_assn ?? "—"}</TableCell>
                <TableCell>{fmtDate(a.emp_asissue)}</TableCell>
                <TableCell>{fmtDate(a.emp_asreturn)}</TableCell>
                <TableCell>{a.emp_ascond ?? "—"}</TableCell>
                <TableCell className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(a)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(a.emp_asid)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Asset" : "Add Asset"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Item Description</Label>
                <Input value={form.emp_asitem ?? ""} onChange={(e) => setForm({ ...form, emp_asitem: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Serial No.</Label>
                <Input value={form.emp_assn ?? ""} onChange={(e) => setForm({ ...form, emp_assn: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Date Issued</Label>
                <Input type="date" value={form.emp_asissue ? new Date(form.emp_asissue).toISOString().substring(0, 10) : ""} onChange={(e) => setForm({ ...form, emp_asissue: e.target.value ? new Date(e.target.value) : null })} />
              </div>
              <div className="space-y-1">
                <Label>Date Returned</Label>
                <Input type="date" value={form.emp_asreturn ? new Date(form.emp_asreturn).toISOString().substring(0, 10) : ""} onChange={(e) => setForm({ ...form, emp_asreturn: e.target.value ? new Date(e.target.value) : null })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Condition</Label>
              <Input value={form.emp_ascond ?? ""} onChange={(e) => setForm({ ...form, emp_ascond: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isPending}>{isPending ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
