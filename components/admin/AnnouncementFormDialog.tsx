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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/lib/hooks/use-toast";
import {
  AnnouncementDTO,
  AnnouncementFormData,
  useCreateAnnouncement,
  useUpdateAnnouncement,
} from "@/lib/hooks/useAdminAnnouncements";

const REPEAT_OPTIONS = [
  { value: "0", label: "Once" },
  { value: "1", label: "Daily" },
  { value: "2", label: "Weekly" },
  { value: "3", label: "Monthly" },
  { value: "4", label: "Yearly" },
];

const TYPE_OPTIONS = [
  { value: "regular", label: "Regular" },
  { value: "urgent", label: "Urgent" },
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
  existing?: AnnouncementDTO | null;
}

export function AnnouncementFormDialog({ open, onClose, existing }: Props) {
  const { toast } = useToast();
  const create = useCreateAnnouncement();
  const update = useUpdateAnnouncement();

  const [headline, setHeadline] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState("regular");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [repeat, setRepeat] = useState("0");
  const [status, setStatus] = useState("1");

  useEffect(() => {
    if (existing) {
      setHeadline(existing.an_headline ?? "");
      setMessage(existing.an_message ?? "");
      setType(existing.an_type ?? "regular");
      setStartDate(toDateInput(existing.an_startdate));
      setEndDate(toDateInput(existing.an_enddate));
      setRepeat(String(existing.an_repeat ?? 0));
      setStatus(String(existing.an_status ?? 1));
    } else {
      setHeadline("");
      setMessage("");
      setType("regular");
      setStartDate("");
      setEndDate("");
      setRepeat("0");
      setStatus("1");
    }
  }, [existing, open]);

  const isPending = create.isPending || update.isPending;

  function handleSubmit() {
    if (!headline.trim() || !message.trim() || !startDate || !endDate) {
      toast({ title: "Please fill in all required fields.", variant: "destructive" });
      return;
    }

    const payload: AnnouncementFormData = {
      an_headline: headline.trim(),
      an_message: message.trim(),
      an_type: type,
      an_startdate: startDate,
      an_enddate: endDate,
      an_repeat: Number(repeat),
      an_status: Number(status),
    };

    if (existing) {
      update.mutate(
        { id: existing.an_id, ...payload },
        {
          onSuccess: () => { toast({ title: "Announcement updated." }); onClose(); },
          onError: (e) => toast({ title: "Update failed.", description: e.message, variant: "destructive" }),
        }
      );
    } else {
      create.mutate(payload, {
        onSuccess: () => { toast({ title: "Announcement created." }); onClose(); },
        onError: (e) => toast({ title: "Create failed.", description: e.message, variant: "destructive" }),
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit Announcement" : "Add Announcement"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Headline <span className="text-red-500">*</span></Label>
            <Input value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={50} />
          </div>

          <div className="space-y-1">
            <Label>Message <span className="text-red-500">*</span></Label>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={200} rows={3} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((o) => (
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Start Date <span className="text-red-500">*</span></Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>End Date <span className="text-red-500">*</span></Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Saving..." : existing ? "Save Changes" : "Add Announcement"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
