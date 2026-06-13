"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
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
import { useToast } from "@/lib/hooks/use-toast";
import {
  HolidayDTO,
  HolidayFormData,
  useCreateHoliday,
  useUpdateHoliday,
  useHolidayTypes,
} from "@/lib/hooks/useAdminHolidays";
import { useAdminLocations } from "@/lib/hooks/useAdminMasterfile";

const REPEAT_OPTIONS = [
  { value: "Yearly", label: "Yearly" },
  { value: "One-time", label: "One-time" },
];

const STATUS_OPTIONS = [
  { value: "1", label: "Active" },
  { value: "0", label: "Inactive" },
];

function toDateInput(val: string | null | undefined) {
  if (!val) return "";
  return val.slice(0, 10);
}

interface Props {
  open: boolean;
  onClose: () => void;
  existing?: HolidayDTO | null;
}

export function HolidayFormDialog({ open, onClose, existing }: Props) {
  const { toast } = useToast();
  const create = useCreateHoliday();
  const update = useUpdateHoliday();
  const { data: types = [] } = useHolidayTypes();
  const { data: locations = [] } = useAdminLocations();

  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [location, setLocation] = useState("__all__");
  const [repeat, setRepeat] = useState("Yearly");
  const [status, setStatus] = useState("1");

  useEffect(() => {
    if (existing) {
      setDate(toDateInput(existing.hol_date));
      setName(existing.hol_name ?? "");
      setType(existing.hol_type ?? "");
      setLocation(existing.hol_location ?? "__all__");
      setRepeat(existing.hol_repeat ?? "Yearly");
      setStatus(String(existing.hol_status ?? 1));
    } else {
      setDate("");
      setName("");
      setType(types[0]?.htp_id ?? "");
      setLocation("__all__");
      setRepeat("Yearly");
      setStatus("1");
    }
  }, [existing, open, types]);

  const isPending = create.isPending || update.isPending;

  function handleSubmit() {
    if (!date || !name.trim() || !type) {
      toast({ title: "Please fill in all required fields.", variant: "destructive" });
      return;
    }

    const payload: HolidayFormData = {
      hol_date: date,
      hol_name: name.trim(),
      hol_type: type,
      hol_location: location === "__all__" ? undefined : location,
      hol_repeat: repeat,
      hol_status: Number(status),
    };

    if (existing) {
      update.mutate(
        { id: existing.hol_id, ...payload },
        {
          onSuccess: () => { toast({ title: "Holiday updated." }); onClose(); },
          onError: (e) => toast({ title: "Update failed.", description: e.message, variant: "destructive" }),
        }
      );
    } else {
      create.mutate(payload, {
        onSuccess: () => { toast({ title: "Holiday created." }); onClose(); },
        onError: (e) => toast({ title: "Create failed.", description: e.message, variant: "destructive" }),
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit Holiday" : "Add Holiday"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Date <span className="text-red-500">*</span></Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label>Holiday Name <span className="text-red-500">*</span></Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={45} />
          </div>

          <div className="space-y-1">
            <Label>Type <span className="text-red-500">*</span></Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                {types.map((t) => (
                  <SelectItem key={t.htp_id} value={t.htp_id}>{t.htp_desc ?? t.htp_id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Location</Label>
            <Select value={location} onValueChange={setLocation}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Locations</SelectItem>
                {locations.map((l) => (
                  <SelectItem key={l.loc_id} value={l.loc_id}>{l.loc_desc ?? l.loc_id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Repeat</Label>
              <Select value={repeat} onValueChange={setRepeat}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REPEAT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Saving..." : existing ? "Save Changes" : "Add Holiday"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
