"use client";

import { useState } from "react";
import { Plus, Edit, Trash2 } from "lucide-react";
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
  Dialog,
  DialogContent,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/lib/hooks/use-toast";
import {
  DepartmentDTO,
  LocationDTO,
  PositionDTO,
  LeaveTypeDTO,
  useAdminDepartments,
  useCreateDepartment,
  useUpdateDepartment,
  useDeleteDepartment,
  useAdminLocations,
  useCreateLocation,
  useUpdateLocation,
  useDeleteLocation,
  useAdminPositions,
  useCreatePosition,
  useUpdatePosition,
  useDeletePosition,
  useAdminLeaveTypes,
  useCreateLeaveType,
  useUpdateLeaveType,
  useDeleteLeaveType,
} from "@/lib/hooks/useAdminMasterfile";
import { UseMutationResult } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/client";

// ─── Shared helpers ───────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: "1", label: "Active" },
  { value: "0", label: "Inactive" },
];

function StatusBadge({ status }: { status: number | null }) {
  return (
    <Badge variant={status === 1 ? "default" : "outline"}>
      {status === 1 ? "Active" : "Inactive"}
    </Badge>
  );
}

function DeleteConfirm({
  open,
  name,
  isPending,
  onClose,
  onConfirm,
}: {
  open: boolean;
  name: string;
  isPending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Record</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete <strong>{name}</strong>? This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isPending}>
            {isPending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── Department Tab ───────────────────────────────────────────────────────────

export function DepartmentTab() {
  const { data: depts = [], isLoading } = useAdminDepartments();
  const create = useCreateDepartment();
  const update = useUpdateDepartment();
  const del = useDeleteDepartment();
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<DepartmentDTO | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DepartmentDTO | null>(null);
  const [id, setId] = useState("");
  const [desc, setDesc] = useState("");
  const [status, setStatus] = useState("1");

  function openAdd() { setEditing(null); setId(""); setDesc(""); setStatus("1"); setShowForm(true); }
  function openEdit(d: DepartmentDTO) { setEditing(d); setId(d.dep_id); setDesc(d.dep_desc ?? ""); setStatus(String(d.dep_status ?? 1)); setShowForm(true); }

  function handleSave() {
    if (!id.trim() || !desc.trim()) { toast({ title: "ID and description required.", variant: "destructive" }); return; }
    const onSuccess = () => { toast({ title: editing ? "Department updated." : "Department added." }); setShowForm(false); };
    const onError = (e: ApiError) => toast({ title: "Error.", description: e.message, variant: "destructive" });

    if (editing) {
      update.mutate({ dep_id: editing.dep_id, dep_desc: desc.trim(), dep_status: Number(status) }, { onSuccess, onError });
    } else {
      create.mutate({ dep_id: id.trim(), dep_desc: desc.trim(), dep_status: Number(status) }, { onSuccess, onError });
    }
  }

  function handleDelete() {
    if (!deleteTarget) return;
    del.mutate(deleteTarget.dep_id, {
      onSuccess: () => { toast({ title: "Department deleted." }); setDeleteTarget(null); },
      onError: (e) => toast({ title: "Delete failed.", description: e.message, variant: "destructive" }),
    });
  }

  return (
    <TabSection
      title="Departments"
      onAdd={openAdd}
      isLoading={isLoading}
      columns={["Code", "Description", "Status", ""]}
      rows={depts.map((d) => ({
        key: d.dep_id,
        cells: [d.dep_id, d.dep_desc, <StatusBadge key="s" status={d.dep_status} />],
        onEdit: () => openEdit(d),
        onDelete: () => setDeleteTarget(d),
      }))}
    >
      <Dialog open={showForm} onOpenChange={(v) => { if (!v) setShowForm(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editing ? "Edit Department" : "Add Department"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Code <span className="text-red-500">*</span></Label>
              <Input value={id} onChange={(e) => setId(e.target.value)} disabled={!!editing} maxLength={5} placeholder="e.g. HR" />
            </div>
            <div className="space-y-1">
              <Label>Description <span className="text-red-500">*</span></Label>
              <Input value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={100} />
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={create.isPending || update.isPending}>
              {create.isPending || update.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <DeleteConfirm open={!!deleteTarget} name={deleteTarget?.dep_desc ?? ""} isPending={del.isPending} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} />
    </TabSection>
  );
}

// ─── Location Tab ─────────────────────────────────────────────────────────────

export function LocationTab() {
  const { data: locs = [], isLoading } = useAdminLocations();
  const create = useCreateLocation();
  const update = useUpdateLocation();
  const del = useDeleteLocation();
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<LocationDTO | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LocationDTO | null>(null);
  const [id, setId] = useState("");
  const [desc, setDesc] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("1");

  function openAdd() { setEditing(null); setId(""); setDesc(""); setCode(""); setStatus("1"); setShowForm(true); }
  function openEdit(l: LocationDTO) { setEditing(l); setId(l.loc_id); setDesc(l.loc_desc ?? ""); setCode(l.loc_code ?? ""); setStatus(String(l.loc_status ?? 1)); setShowForm(true); }

  function handleSave() {
    if (!id.trim() || !desc.trim()) { toast({ title: "ID and description required.", variant: "destructive" }); return; }
    const onSuccess = () => { toast({ title: editing ? "Location updated." : "Location added." }); setShowForm(false); };
    const onError = (e: ApiError) => toast({ title: "Error.", description: e.message, variant: "destructive" });
    if (editing) {
      update.mutate({ loc_id: editing.loc_id, loc_desc: desc.trim(), loc_code: code.trim(), loc_status: Number(status) }, { onSuccess, onError });
    } else {
      create.mutate({ loc_id: id.trim(), loc_desc: desc.trim(), loc_code: code.trim(), loc_status: Number(status) }, { onSuccess, onError });
    }
  }

  function handleDelete() {
    if (!deleteTarget) return;
    del.mutate(deleteTarget.loc_id, {
      onSuccess: () => { toast({ title: "Location deleted." }); setDeleteTarget(null); },
      onError: (e) => toast({ title: "Delete failed.", description: e.message, variant: "destructive" }),
    });
  }

  return (
    <TabSection
      title="Locations"
      onAdd={openAdd}
      isLoading={isLoading}
      columns={["Code", "Location Name", "Short Code", "Status", ""]}
      rows={locs.map((l) => ({
        key: l.loc_id,
        cells: [l.loc_id, l.loc_desc, l.loc_code, <StatusBadge key="s" status={l.loc_status} />],
        onEdit: () => openEdit(l),
        onDelete: () => setDeleteTarget(l),
      }))}
    >
      <Dialog open={showForm} onOpenChange={(v) => { if (!v) setShowForm(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editing ? "Edit Location" : "Add Location"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Code <span className="text-red-500">*</span></Label>
              <Input value={id} onChange={(e) => setId(e.target.value)} disabled={!!editing} maxLength={5} placeholder="e.g. MNL" />
            </div>
            <div className="space-y-1">
              <Label>Location Name <span className="text-red-500">*</span></Label>
              <Input value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={100} />
            </div>
            <div className="space-y-1">
              <Label>Short Code</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} maxLength={4} placeholder="e.g. MNL" />
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={create.isPending || update.isPending}>
              {create.isPending || update.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <DeleteConfirm open={!!deleteTarget} name={deleteTarget?.loc_desc ?? ""} isPending={del.isPending} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} />
    </TabSection>
  );
}

// ─── Position Tab ─────────────────────────────────────────────────────────────

export function PositionTab() {
  const { data: positions = [], isLoading } = useAdminPositions();
  const create = useCreatePosition();
  const update = useUpdatePosition();
  const del = useDeletePosition();
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PositionDTO | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PositionDTO | null>(null);
  const [id, setId] = useState("");
  const [desc, setDesc] = useState("");
  const [status, setStatus] = useState("1");

  function openAdd() { setEditing(null); setId(""); setDesc(""); setStatus("1"); setShowForm(true); }
  function openEdit(p: PositionDTO) { setEditing(p); setId(p.pst_id); setDesc(p.pst_desc ?? ""); setStatus(String(p.pst_Status ?? 1)); setShowForm(true); }

  function handleSave() {
    if (!id.trim() || !desc.trim()) { toast({ title: "ID and description required.", variant: "destructive" }); return; }
    const onSuccess = () => { toast({ title: editing ? "Position updated." : "Position added." }); setShowForm(false); };
    const onError = (e: ApiError) => toast({ title: "Error.", description: e.message, variant: "destructive" });
    if (editing) {
      update.mutate({ pst_id: editing.pst_id, pst_desc: desc.trim(), pst_Status: Number(status) }, { onSuccess, onError });
    } else {
      create.mutate({ pst_id: id.trim(), pst_desc: desc.trim(), pst_Status: Number(status) }, { onSuccess, onError });
    }
  }

  function handleDelete() {
    if (!deleteTarget) return;
    del.mutate(deleteTarget.pst_id, {
      onSuccess: () => { toast({ title: "Position deleted." }); setDeleteTarget(null); },
      onError: (e) => toast({ title: "Delete failed.", description: e.message, variant: "destructive" }),
    });
  }

  return (
    <TabSection
      title="Positions"
      onAdd={openAdd}
      isLoading={isLoading}
      columns={["Code", "Description", "Status", ""]}
      rows={positions.map((p) => ({
        key: p.pst_id,
        cells: [p.pst_id, p.pst_desc, <StatusBadge key="s" status={p.pst_Status} />],
        onEdit: () => openEdit(p),
        onDelete: () => setDeleteTarget(p),
      }))}
    >
      <Dialog open={showForm} onOpenChange={(v) => { if (!v) setShowForm(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editing ? "Edit Position" : "Add Position"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Code <span className="text-red-500">*</span></Label>
              <Input value={id} onChange={(e) => setId(e.target.value)} disabled={!!editing} maxLength={5} placeholder="e.g. MGR" />
            </div>
            <div className="space-y-1">
              <Label>Description <span className="text-red-500">*</span></Label>
              <Input value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={100} />
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={create.isPending || update.isPending}>
              {create.isPending || update.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <DeleteConfirm open={!!deleteTarget} name={deleteTarget?.pst_desc ?? ""} isPending={del.isPending} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} />
    </TabSection>
  );
}

// ─── Leave Type Tab ───────────────────────────────────────────────────────────

export function LeaveTypeTab() {
  const { data: types = [], isLoading } = useAdminLeaveTypes();
  const create = useCreateLeaveType();
  const update = useUpdateLeaveType();
  const del = useDeleteLeaveType();
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<LeaveTypeDTO | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LeaveTypeDTO | null>(null);
  const [id, setId] = useState("");
  const [desc, setDesc] = useState("");
  const [days, setDays] = useState<number | "">(0);
  const [before, setBefore] = useState<number | "">(0);
  const [lead, setLead] = useState<number | "">(0);
  const [after, setAfter] = useState<number | "">(0);
  const [status, setStatus] = useState("1");

  function openAdd() { setEditing(null); setId(""); setDesc(""); setDays(0); setBefore(0); setLead(0); setAfter(0); setStatus("1"); setShowForm(true); }
  function openEdit(l: LeaveTypeDTO) {
    setEditing(l); setId(l.lev_id); setDesc(l.lev_desc ?? "");
    setDays(l.lev_days ?? 0); setBefore(l.lev_before ?? 0); setLead(l.lev_lead ?? 0); setAfter(l.lev_after ?? 0);
    setStatus(String(l.lev_status ?? 1)); setShowForm(true);
  }

  function handleSave() {
    if (!id.trim() || !desc.trim()) { toast({ title: "ID and description required.", variant: "destructive" }); return; }
    const payload: LeaveTypeDTO = {
      lev_id: id.trim(), lev_desc: desc.trim(), lev_days: Number(days),
      lev_status: Number(status), lev_before: Number(before), lev_lead: Number(lead), lev_after: Number(after),
    };
    const onSuccess = () => { toast({ title: editing ? "Leave type updated." : "Leave type added." }); setShowForm(false); };
    const onError = (e: ApiError) => toast({ title: "Error.", description: e.message, variant: "destructive" });
    if (editing) {
      update.mutate(payload, { onSuccess, onError });
    } else {
      create.mutate(payload, { onSuccess, onError });
    }
  }

  function handleDelete() {
    if (!deleteTarget) return;
    del.mutate(deleteTarget.lev_id, {
      onSuccess: () => { toast({ title: "Leave type deleted." }); setDeleteTarget(null); },
      onError: (e) => toast({ title: "Delete failed.", description: e.message, variant: "destructive" }),
    });
  }

  return (
    <TabSection
      title="Leave Types"
      onAdd={openAdd}
      isLoading={isLoading}
      columns={["Code", "Description", "Days", "Before", "Lead", "After", "Status", ""]}
      rows={types.map((l) => ({
        key: l.lev_id,
        cells: [l.lev_id, l.lev_desc, l.lev_days, l.lev_before, l.lev_lead, l.lev_after, <StatusBadge key="s" status={l.lev_status} />],
        onEdit: () => openEdit(l),
        onDelete: () => setDeleteTarget(l),
      }))}
    >
      <Dialog open={showForm} onOpenChange={(v) => { if (!v) setShowForm(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Edit Leave Type" : "Add Leave Type"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Code <span className="text-red-500">*</span></Label>
                <Input value={id} onChange={(e) => setId(e.target.value)} disabled={!!editing} maxLength={5} placeholder="e.g. VL" />
              </div>
              <div className="space-y-1">
                <Label>Days Entitlement</Label>
                <Input type="number" value={days} onChange={(e) => setDays(e.target.value === "" ? "" : Number(e.target.value))} min={0} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Description <span className="text-red-500">*</span></Label>
              <Input value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={100} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Before (days)</Label>
                <Input type="number" value={before} onChange={(e) => setBefore(e.target.value === "" ? "" : Number(e.target.value))} min={0} />
              </div>
              <div className="space-y-1">
                <Label>Lead (days)</Label>
                <Input type="number" value={lead} onChange={(e) => setLead(e.target.value === "" ? "" : Number(e.target.value))} min={0} />
              </div>
              <div className="space-y-1">
                <Label>After (days)</Label>
                <Input type="number" value={after} onChange={(e) => setAfter(e.target.value === "" ? "" : Number(e.target.value))} min={0} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={create.isPending || update.isPending}>
              {create.isPending || update.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <DeleteConfirm open={!!deleteTarget} name={deleteTarget?.lev_desc ?? ""} isPending={del.isPending} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} />
    </TabSection>
  );
}

// ─── Shared TabSection layout ─────────────────────────────────────────────────

interface Row {
  key: string | number;
  cells: (React.ReactNode | string | number | null | undefined)[];
  onEdit: () => void;
  onDelete: () => void;
}

function TabSection({
  title,
  onAdd,
  isLoading,
  columns,
  rows,
  children,
}: {
  title: string;
  onAdd: () => void;
  isLoading: boolean;
  columns: string[];
  rows: Row[];
  children: React.ReactNode;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-10 rounded bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="font-medium text-muted-foreground">{title}</span>
        <Button size="sm" onClick={onAdd}>
          <Plus className="w-4 h-4 mr-1" />
          Add
        </Button>
      </div>

      <div className="rounded-md border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col, i) => (
                <TableHead key={i} className={col === "" ? "w-20 text-center" : ""}>{col}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center text-muted-foreground py-8">
                  No records found.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.key}>
                  {row.cells.map((cell, i) => (
                    <TableCell key={i}>{cell ?? "—"}</TableCell>
                  ))}
                  <TableCell>
                    <div className="flex justify-center gap-1">
                      <Button variant="ghost" size="icon" onClick={row.onEdit}><Edit className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={row.onDelete}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {children}
    </div>
  );
}
