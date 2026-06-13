"use client";

import { useState } from "react";
import { ApiError } from "@/lib/api/client";
import { RoleIncludeDTO, useDeleteRole } from "@/lib/hooks/useRolesPermissions";
import { useToast } from "@/lib/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DeleteRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: RoleIncludeDTO | null;
}

/**
 * Confirmation dialog wrapping `useDeleteRole`. Mirrors the legacy delete
 * branch of `RolePopup.razor` and surfaces the "still assigned to employees"
 * 409 error from the API in plain language.
 */
export function DeleteRoleDialog({ open, onOpenChange, role }: DeleteRoleDialogProps) {
  const { toast } = useToast();
  const deleteMutation = useDeleteRole();
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    if (!role) return;
    setError(null);
    try {
      await deleteMutation.mutateAsync(role.RolId);
      toast({ title: "Role deleted" });
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Unable to delete role";
      setError(message);
      toast({
        variant: "destructive",
        title: "Failed to delete role",
        description: message,
      });
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) setError(null);
        onOpenChange(value);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Role</DialogTitle>
          <DialogDescription>
            Do you really want to delete <b>&quot;{role?.RolName ?? role?.RolId}&quot;</b>?
            This will remove the role and all of its permission assignments.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleteMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
