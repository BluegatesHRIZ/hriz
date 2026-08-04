"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/lib/hooks/use-toast";
import { useCreateScheduleTemplate } from "@/lib/hooks/useScheduleTemplates";
import type { ScheduleDayValue } from "./scheduleDays";

interface SaveTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  days: ScheduleDayValue[];
}

/** Small dialog to save the currently-built week as a named, reusable template. */
export function SaveTemplateDialog({
  open,
  onOpenChange,
  days,
}: SaveTemplateDialogProps) {
  const { toast } = useToast();
  const createTemplate = useCreateScheduleTemplate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const handleSave = async () => {
    if (!name.trim()) {
      toast({
        title: "Name required",
        description: "Give this template a name.",
        variant: "destructive",
      });
      return;
    }
    try {
      await createTemplate.mutateAsync({
        name: name.trim(),
        description: description.trim() || null,
        days,
      });
      toast({ title: "Template saved", description: `"${name.trim()}" is ready to reuse.` });
      setName("");
      setDescription("");
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Couldn't save template",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save as template</DialogTitle>
          <DialogDescription>
            Save this weekly schedule so you can apply it again later without
            rebuilding it.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="template-name">Template name</Label>
            <Input
              id="template-name"
              placeholder="e.g. Morning Shift (8–5)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="template-desc">Description (optional)</Label>
            <Textarea
              id="template-desc"
              placeholder="A short note about when to use this."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={createTemplate.isPending}>
            {createTemplate.isPending ? "Saving…" : "Save template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
