"use client";

import { useState } from "react";
import { Plus, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { HolidayDTO, useAdminHolidays, useDeleteHoliday } from "@/lib/hooks/useAdminHolidays";
import { HolidayFormDialog } from "@/components/admin/HolidayFormDialog";

function formatDate(val: string | null | undefined) {
  if (!val) return "—";
  return new Date(val).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
}

export function HolidayManagementTable() {
  const { data: holidays = [], isLoading } = useAdminHolidays();
  const { toast } = useToast();
  const deleteHoliday = useDeleteHoliday();

  const [editTarget, setEditTarget] = useState<HolidayDTO | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<HolidayDTO | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  function handleDelete() {
    if (!deleteTarget) return;
    deleteHoliday.mutate(deleteTarget.hol_id, {
      onSuccess: () => { toast({ title: "Holiday deleted." }); setDeleteTarget(null); },
      onError: (e) => toast({ title: "Delete failed.", description: e.message, variant: "destructive" }),
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Holiday Maintenance</h2>
        <Button onClick={() => setShowAdd(true)}>
          <Plus className="w-4 h-4 mr-1" />
          Add Holiday
        </Button>
      </div>

      <div className="rounded-md border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Holiday Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Repeat</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24 text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {holidays.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                  No holidays found.
                </TableCell>
              </TableRow>
            ) : (
              holidays.map((h) => (
                <TableRow key={h.hol_id}>
                  <TableCell>{formatDate(h.hol_date)}</TableCell>
                  <TableCell className="font-medium">{h.hol_name}</TableCell>
                  <TableCell>{h.hol_type}</TableCell>
                  <TableCell>{h.hol_location ?? <span className="text-muted-foreground">All</span>}</TableCell>
                  <TableCell>{h.hol_repeat ?? "Yearly"}</TableCell>
                  <TableCell>
                    <Badge variant={h.hol_status === 1 ? "default" : "outline"}>
                      {h.hol_status === 1 ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-center gap-1">
                      <Button variant="ghost" size="icon" title="Edit" onClick={() => setEditTarget(h)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Delete" onClick={() => setDeleteTarget(h)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <HolidayFormDialog
        open={showAdd || !!editTarget}
        existing={editTarget}
        onClose={() => { setShowAdd(false); setEditTarget(null); }}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Holiday</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.hol_name}</strong>? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTarget(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleteHoliday.isPending}>
              {deleteHoliday.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
