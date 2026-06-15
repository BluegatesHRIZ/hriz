"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAdminLocations } from "@/lib/hooks/useAdminMasterfile";
import {
  DeviceDTO,
  DeviceFormData,
  useCreateDevice,
  useUpdateDevice,
} from "@/lib/hooks/useAdminDevices";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editTarget?: DeviceDTO | null;
}

const empty: DeviceFormData = {
  ter_code: "",
  ter_id: "",
  ter_ip: "",
  ter_loc: "",
  ter_biopass: "",
  ter_biokey: "",
  ter_device: "",
  ter_type: 0,
};

export function DeviceFormDialog({ open, onOpenChange, editTarget }: Props) {
  const [form, setForm] = useState<DeviceFormData>(empty);
  const [error, setError] = useState<string | null>(null);

  const { data: locations = [] } = useAdminLocations();
  const create = useCreateDevice();
  const update = useUpdateDevice();

  const isEdit = !!editTarget;
  const pending = create.isPending || update.isPending;

  useEffect(() => {
    if (open) {
      if (editTarget) {
        setForm({
          ter_code: editTarget.ter_code,
          ter_id: editTarget.ter_id ?? "",
          ter_ip: editTarget.ter_ip ?? "",
          ter_loc: editTarget.ter_loc ?? "",
          ter_biopass: editTarget.ter_biopass ?? "",
          ter_biokey: editTarget.ter_biokey ?? "",
          ter_device: editTarget.ter_device ?? "",
          ter_type: editTarget.ter_type ?? 0,
        });
      } else {
        setForm(empty);
      }
      setError(null);
    }
  }, [open, editTarget]);

  function field(k: keyof DeviceFormData, val: string | number) {
    setForm((f) => ({ ...f, [k]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.ter_code.trim()) {
      setError("Device code is required.");
      return;
    }
    if (!form.ter_id.trim()) {
      setError("Device name is required.");
      return;
    }
    if (form.ter_ip && !/^(\d{1,3}\.){3}\d{1,3}$/.test(form.ter_ip.trim())) {
      setError("IP address format is invalid (e.g. 192.168.1.100).");
      return;
    }

    try {
      if (isEdit) {
        await update.mutateAsync({
          ter_code: form.ter_code,
          ter_id: form.ter_id,
          ter_ip: form.ter_ip,
          ter_loc: form.ter_loc,
          ter_biopass: form.ter_biopass,
          ter_biokey: form.ter_biokey,
          ter_device: form.ter_device,
          ter_type: form.ter_type,
        });
      } else {
        await create.mutateAsync(form);
      }
      onOpenChange(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Device" : "Register Device"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Device Code */}
          <div className="grid grid-cols-12 items-center gap-2">
            <Label className="col-span-4 text-right text-sm">Device Code</Label>
            <div className="col-span-8">
              <Input
                value={form.ter_code}
                onChange={(e) => field("ter_code", e.target.value)}
                maxLength={20}
                required
                disabled={isEdit}
                placeholder="e.g. TER001"
              />
            </div>
          </div>

          {/* Device Name / ID */}
          <div className="grid grid-cols-12 items-center gap-2">
            <Label className="col-span-4 text-right text-sm">Device Name</Label>
            <div className="col-span-8">
              <Input
                value={form.ter_id}
                onChange={(e) => field("ter_id", e.target.value)}
                maxLength={100}
                required
                placeholder="Friendly name"
              />
            </div>
          </div>

          {/* IP Address */}
          <div className="grid grid-cols-12 items-center gap-2">
            <Label className="col-span-4 text-right text-sm">IP Address</Label>
            <div className="col-span-8">
              <Input
                value={form.ter_ip}
                onChange={(e) => field("ter_ip", e.target.value)}
                placeholder="192.168.1.100"
                maxLength={50}
              />
            </div>
          </div>

          {/* Location */}
          <div className="grid grid-cols-12 items-center gap-2">
            <Label className="col-span-4 text-right text-sm">Location</Label>
            <div className="col-span-8">
              <Select
                value={form.ter_loc ?? ""}
                onValueChange={(v) => field("ter_loc", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">— None —</SelectItem>
                  {locations.map((loc) => (
                    <SelectItem key={loc.loc_id} value={loc.loc_id}>
                      {loc.loc_desc}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Device Type */}
          <div className="grid grid-cols-12 items-center gap-2">
            <Label className="col-span-4 text-right text-sm">Device Type</Label>
            <div className="col-span-8">
              <Select
                value={String(form.ter_type ?? 0)}
                onValueChange={(v) => field("ter_type", Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Standard</SelectItem>
                  <SelectItem value="1">Biometric</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Bio Password */}
          <div className="grid grid-cols-12 items-center gap-2">
            <Label className="col-span-4 text-right text-sm">Bio Password</Label>
            <div className="col-span-8">
              <Input
                value={form.ter_biopass ?? ""}
                onChange={(e) => field("ter_biopass", e.target.value)}
                maxLength={50}
                placeholder="Optional"
              />
            </div>
          </div>

          {/* Bio Key */}
          <div className="grid grid-cols-12 items-center gap-2">
            <Label className="col-span-4 text-right text-sm">Bio Key</Label>
            <div className="col-span-8">
              <Input
                value={form.ter_biokey ?? ""}
                onChange={(e) => field("ter_biokey", e.target.value)}
                maxLength={100}
                placeholder="Optional"
              />
            </div>
          </div>

          {/* Device Serial */}
          <div className="grid grid-cols-12 items-center gap-2">
            <Label className="col-span-4 text-right text-sm">Device Serial</Label>
            <div className="col-span-8">
              <Input
                value={form.ter_device ?? ""}
                onChange={(e) => field("ter_device", e.target.value)}
                maxLength={100}
                placeholder="Optional serial number"
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : isEdit ? "Save Changes" : "Register"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
