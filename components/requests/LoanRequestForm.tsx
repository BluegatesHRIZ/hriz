"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  LoanDTO,
  useCreateLoan,
  useLoanById,
  useUpdateLoan,
} from "@/lib/hooks/useRequestManagement";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/lib/hooks/use-toast";

const loanSchema = z.object({
  LoaAmt: z.coerce.number().positive("Loan amount must be greater than zero"),
  LoaReason: z.string().min(1, "Reason is required").max(200, "Reason is too long"),
  LoaType: z.string().optional(),
  LoaExprelease: z.string().optional(),
});

type LoanFormValues = z.infer<typeof loanSchema>;

interface LoanRequestFormProps {
  loanId?: string;
  onSuccess: () => void;
}

function toDateInput(value?: Date | string | null): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function LoanRequestForm({ loanId, onSuccess }: LoanRequestFormProps) {
  const { toast } = useToast();
  const { data: existing } = useLoanById(loanId || "");
  const createMutation = useCreateLoan();
  const updateMutation = useUpdateLoan(loanId || "");

  const form = useForm<LoanFormValues>({
    resolver: zodResolver(loanSchema),
    mode: "onSubmit",
    defaultValues: {
      LoaAmt: 0,
      LoaReason: "",
      LoaType: "",
      LoaExprelease: "",
    },
  });

  useEffect(() => {
    if (!loanId || !existing) return;
    form.reset({
      LoaAmt: existing.LoaAmt ?? 0,
      LoaReason: existing.LoaReason ?? "",
      LoaType: existing.LoaType ?? "",
      LoaExprelease: toDateInput(existing.LoaExprelease),
    });
  }, [loanId, existing, form]);

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  async function onSubmit(values: LoanFormValues) {
    const payload: LoanDTO = {
      LoaAmt: values.LoaAmt,
      LoaReason: values.LoaReason.trim(),
      LoaType: values.LoaType?.trim() || "",
      LoaExprelease: values.LoaExprelease
        ? new Date(`${values.LoaExprelease}T00:00:00`)
        : null,
    };

    try {
      if (loanId) {
        await updateMutation.mutateAsync(payload);
        toast({ title: "Loan updated", description: "Loan request updated successfully." });
      } else {
        await createMutation.mutateAsync(payload);
        toast({ title: "Loan submitted", description: "Loan request submitted successfully." });
      }
      onSuccess();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Unable to save loan request",
        description: error instanceof Error ? error.message : "Please try again later.",
      });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{loanId ? "Edit Loan Request" : "Apply for Loan"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Loan Amount</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={form.watch("LoaAmt")}
                onChange={(e) =>
                  form.setValue("LoaAmt", Number(e.target.value), {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Expected Release Date</Label>
              <Input
                type="date"
                value={form.watch("LoaExprelease") || ""}
                onChange={(e) =>
                  form.setValue("LoaExprelease", e.target.value, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Loan Type</Label>
            <Input
              value={form.watch("LoaType") || ""}
              onChange={(e) =>
                form.setValue("LoaType", e.target.value, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
              placeholder="Optional loan type"
            />
          </div>

          <div className="space-y-2">
            <Label>Reason</Label>
            <Textarea
              rows={4}
              value={form.watch("LoaReason") || ""}
              onChange={(e) =>
                form.setValue("LoaReason", e.target.value, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
              placeholder="Explain your loan request"
            />
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : loanId ? "Update Request" : "Submit Request"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

