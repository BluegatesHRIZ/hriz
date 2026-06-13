"use client";

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
import { AnnouncementDTO, useDeleteAnnouncement } from "@/lib/hooks/useAdminAnnouncements";

interface Props {
  target: AnnouncementDTO | null;
  onClose: () => void;
}

export function DeleteAnnouncementDialog({ target, onClose }: Props) {
  const { toast } = useToast();
  const del = useDeleteAnnouncement();

  function handleConfirm() {
    if (!target) return;
    del.mutate(target.an_id, {
      onSuccess: () => { toast({ title: "Announcement deleted." }); onClose(); },
      onError: (e) => toast({ title: "Delete failed.", description: e.message, variant: "destructive" }),
    });
  }

  return (
    <AlertDialog open={!!target} onOpenChange={(v) => { if (!v) onClose(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Announcement</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete <strong>{target?.an_headline}</strong>? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={del.isPending}>
            {del.isPending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
