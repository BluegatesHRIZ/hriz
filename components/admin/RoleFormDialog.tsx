"use client";

import { useMemo, useState } from "react";
import { ApiError } from "@/lib/api/client";
import {
  PermissionDTO,
  RoleFormPayload,
  RoleIncludeDTO,
  useCreateRole,
  usePermissionsList,
  useUpdateRole,
} from "@/lib/hooks/useRolesPermissions";
import { useToast } from "@/lib/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type DialogMode = "add" | "edit";

interface RoleFormDialogProps {
  mode: DialogMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Existing role payload (required when mode === "edit"). */
  role?: RoleIncludeDTO | null;
  /** Roles available for the "Copy from" combobox (excludes the current role). */
  copyOptions: RoleIncludeDTO[];
}

interface PermissionGroup {
  title: string;
  filter: (perId: string) => boolean;
}

const PERMISSION_GROUPS: PermissionGroup[] = [
  { title: "Access Permissions", filter: (id) => id.startsWith("ACC") },
  { title: "Function Permissions", filter: (id) => id.startsWith("FUNC") },
];

const COPY_NONE_VALUE = "__none__";

/**
 * Form body for the dialog. Lives in its own component so that we can remount
 * (via a `key` on this element) whenever the dialog opens, giving us fresh
 * state without resorting to a `useEffect` reset.
 */
function RoleFormBody({
  mode,
  role,
  copyOptions,
  onClose,
}: {
  mode: DialogMode;
  role?: RoleIncludeDTO | null;
  copyOptions: RoleIncludeDTO[];
  onClose: () => void;
}) {
  const { toast } = useToast();
  const { data: permissions = [], isLoading: permissionsLoading } = usePermissionsList();
  const createMutation = useCreateRole();
  const updateMutation = useUpdateRole(role?.RolId ?? "");

  const initialPermIds =
    mode === "edit" && role
      ? new Set(
          role.RolesAndPermissionNav.map((p) => p.ArpPer).filter(
            (v): v is string => Boolean(v),
          ),
        )
      : new Set<string>();

  const [rolName, setRolName] = useState(role?.RolName ?? "");
  const [rolDesc, setRolDesc] = useState(role?.RolDesc ?? "");
  const [selectedPermIds, setSelectedPermIds] = useState<Set<string>>(initialPermIds);
  const [copyRoleId, setCopyRoleId] = useState<string>(COPY_NONE_VALUE);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const sortedPermissions = useMemo<PermissionDTO[]>(
    () =>
      [...permissions].sort((a, b) => {
        const an = a.PerName ?? a.PerId;
        const bn = b.PerName ?? b.PerId;
        return an.localeCompare(bn);
      }),
    [permissions],
  );

  function togglePermission(perId: string, checked: boolean) {
    setSelectedPermIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(perId);
      else next.delete(perId);
      return next;
    });
  }

  function applyCopyFromRole(value: string) {
    setCopyRoleId(value);
    if (value === COPY_NONE_VALUE) {
      setSelectedPermIds(new Set());
      return;
    }
    const target = copyOptions.find((r) => r.RolId === value);
    if (!target) return;
    setSelectedPermIds(
      new Set(
        target.RolesAndPermissionNav.map((p) => p.ArpPer).filter(
          (v): v is string => Boolean(v),
        ),
      ),
    );
  }

  async function handleSubmit() {
    setSubmitError(null);
    const trimmedName = rolName.trim();
    const trimmedDesc = rolDesc.trim();
    if (!trimmedName || !trimmedDesc) {
      setSubmitError("Role name and description are required.");
      return;
    }
    const payload: RoleFormPayload = {
      RolName: trimmedName,
      RolDesc: trimmedDesc,
      RolPermission: Array.from(selectedPermIds).map((PerId) => ({ PerId })),
    };

    try {
      if (mode === "add") {
        await createMutation.mutateAsync(payload);
        toast({ title: "Role created" });
      } else {
        if (!role) return;
        await updateMutation.mutateAsync(payload);
        toast({ title: "Role updated" });
      }
      onClose();
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Unable to save role";
      setSubmitError(message);
      toast({
        variant: "destructive",
        title: mode === "add" ? "Failed to create role" : "Failed to update role",
        description: message,
      });
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <DialogHeader>
        <DialogTitle>{mode === "add" ? "Add Role" : "Edit Role"}</DialogTitle>
        <DialogDescription>
          Define the role and pick the permissions it should grant.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="rol-name">Role Name</Label>
          <Input
            id="rol-name"
            value={rolName}
            onChange={(e) => setRolName(e.target.value)}
            placeholder="e.g. Payroll Manager"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="rol-desc">Role Description</Label>
          <Input
            id="rol-desc"
            value={rolDesc}
            onChange={(e) => setRolDesc(e.target.value)}
            placeholder="Short summary of what the role is for"
          />
        </div>

        {copyOptions.length > 0 && (
          <div className="grid gap-2">
            <Label htmlFor="copy-role">Copy from this role</Label>
            <Select value={copyRoleId} onValueChange={applyCopyFromRole}>
              <SelectTrigger id="copy-role">
                <SelectValue placeholder="No copy model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={COPY_NONE_VALUE}>No copy model</SelectItem>
                {copyOptions.map((option) => (
                  <SelectItem key={option.RolId} value={option.RolId}>
                    {option.RolName || option.RolId}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {PERMISSION_GROUPS.map((group) => {
          const groupPermissions = sortedPermissions.filter((p) =>
            group.filter(p.PerId),
          );
          if (groupPermissions.length === 0) return null;
          return (
            <div key={group.title} className="space-y-2">
              <h4 className="text-sm font-semibold text-gray-700">{group.title}</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 rounded-md border p-3">
                {permissionsLoading ? (
                  <p className="text-sm text-gray-500">Loading permissions...</p>
                ) : (
                  groupPermissions.map((perm) => {
                    const checked = selectedPermIds.has(perm.PerId);
                    return (
                      <label
                        key={perm.PerId}
                        className="flex items-start gap-2 cursor-pointer"
                        title={perm.PerDesc ?? ""}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) =>
                            togglePermission(perm.PerId, value === true)
                          }
                        />
                        <span className="text-sm leading-tight">
                          {perm.PerName ?? perm.PerId}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}

        {submitError && (
          <p className="text-sm text-red-600" role="alert">
            {submitError}
          </p>
        )}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={isSaving}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={isSaving}>
          {isSaving ? "Saving..." : mode === "add" ? "Submit" : "Save"}
        </Button>
      </DialogFooter>
    </>
  );
}

/**
 * Roles editor dialog that mirrors the legacy `RolePopup.razor`:
 *
 * - Name + description text inputs (required).
 * - "Copy from this role" combobox that prefills the permission checkboxes.
 * - Two grouped checkbox lists (Access `ACC*` and Function `FUNC*` permissions).
 *
 * Submit calls `useCreateRole` or `useUpdateRole`, mirroring the C# endpoints.
 *
 * The form body is keyed by the open/role identity so it remounts each time
 * the dialog opens – we get a clean state without a `useEffect` reset.
 */
export function RoleFormDialog({
  mode,
  open,
  onOpenChange,
  role,
  copyOptions,
}: RoleFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {open && (
          <RoleFormBody
            key={`${mode}-${role?.RolId ?? "new"}`}
            mode={mode}
            role={role}
            copyOptions={copyOptions}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
