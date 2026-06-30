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
import { AnnouncementDTO, useAdminAnnouncements } from "@/lib/hooks/useAdminAnnouncements";
import { AnnouncementFormDialog } from "@/components/admin/AnnouncementFormDialog";
import { DeleteAnnouncementDialog } from "@/components/admin/DeleteAnnouncementDialog";
import { Pagination } from "@/components/ui/Pagination";

const REPEAT_LABELS: Record<number, string> = {
  0: "Once",
  1: "Daily",
  2: "Weekly",
  3: "Monthly",
  4: "Yearly",
};

function formatDate(val: string | null | undefined) {
  if (!val) return "—";
  return new Date(val).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
}

export function AnnouncementManagementTable() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAdminAnnouncements(page);
  const announcements = data?.data ?? [];
  const meta = data?.meta;
  const [editTarget, setEditTarget] = useState<AnnouncementDTO | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AnnouncementDTO | null>(null);
  const [showAdd, setShowAdd] = useState(false);

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
        <h2 className="text-2xl font-semibold">Announcements</h2>
        <Button onClick={() => setShowAdd(true)}>
          <Plus className="w-4 h-4 mr-1" />
          Add Announcement
        </Button>
      </div>

      <div className="rounded-md border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Headline</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Start Date</TableHead>
              <TableHead>End Date</TableHead>
              <TableHead>Repeat</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24 text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {announcements.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                  No announcements found.
                </TableCell>
              </TableRow>
            ) : (
              announcements.map((a) => (
                <TableRow key={a.an_id}>
                  <TableCell className="font-medium max-w-xs truncate">{a.an_headline}</TableCell>
                  <TableCell>
                    <Badge variant={a.an_type === "urgent" ? "destructive" : "secondary"} className="capitalize">
                      {a.an_type ?? "regular"}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(a.an_startdate)}</TableCell>
                  <TableCell>{formatDate(a.an_enddate)}</TableCell>
                  <TableCell>{REPEAT_LABELS[a.an_repeat ?? 0] ?? "Once"}</TableCell>
                  <TableCell>
                    <Badge variant={a.an_status === 1 ? "default" : "outline"}>
                      {a.an_status === 1 ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-center gap-1">
                      <Button variant="ghost" size="icon" title="Edit" onClick={() => setEditTarget(a)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Delete" onClick={() => setDeleteTarget(a)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {meta && (
          <div className="px-4 pb-4">
            <Pagination meta={meta} onPageChange={setPage} />
          </div>
        )}
      </div>

      <AnnouncementFormDialog
        open={showAdd || !!editTarget}
        existing={editTarget}
        onClose={() => { setShowAdd(false); setEditTarget(null); }}
      />
      <DeleteAnnouncementDialog
        target={deleteTarget}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
