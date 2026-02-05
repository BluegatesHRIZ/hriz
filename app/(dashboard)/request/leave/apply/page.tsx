"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuth } from "@/lib/auth/context";
import {
  useLeaveTypes,
  useLeaveCredits,
  useCreateLeaveSummary,
  useLeaveSummary,
  useUpdateLeaveSummary,
} from "@/lib/hooks/useRequestManagement";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/lib/hooks/use-toast";
import { LeaveRequestForm } from "@/components/requests/LeaveRequestForm";

const leaveRequestSchema = z.object({
  LeaStype: z.string().min(1, "Leave type is required"),
  LeaSfrom: z.date({ error: "Start date is required" }),
  LeaSto: z.date({ error: "End date is required" }),
  LeaSreason: z.string().min(1, "Reason is required"),
});

export default function LeaveApplyPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();

  const form = useForm({
    resolver: zodResolver(leaveRequestSchema),
    defaultValues: {
      LeaStype: "",
      LeaSfrom: undefined,
      LeaSto: undefined,
      LeaSreason: "",
    },
  });

  const { data: leaveTypes } = useLeaveTypes();
  const { data: leaveCredits } = useLeaveCredits(user?.name || "");

  const createMutation = useCreateLeaveSummary(user?.name || "");

  const handleSubmit = async (data: z.infer<typeof leaveRequestSchema>) => {
    try {
      // TODO: Generate leave details from date range
      // For now, create a basic structure
      const leaveRequest = {
        ...data,
        leavedetail: [], // Will be populated based on date range
        LeaSwithpay: 0,
        LeaSwithoutpay: 0,
      };

      await createMutation.mutateAsync(leaveRequest as any);
      toast({
        title: "Success",
        description: "Leave request submitted successfully",
      });
      router.push("/request/leave");
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to submit leave request",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto mt-4 mb-5 pb-5 pt-4 px-4">
      <div className="request-section">
        <div className="header-container mb-4">
          <h3 className="text-xl font-semibold text-bgc-text-highlight">
            Leave Request
          </h3>
        </div>

        <LeaveRequestForm
          empId={user?.name || ""}
          onSuccess={() => router.push("/request/leave")}
        />
      </div>
    </div>
  );
}
