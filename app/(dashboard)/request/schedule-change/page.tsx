"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useScheduleAdjustList } from "@/lib/hooks/useRequestManagement";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, Hourglass, CheckCircle2, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ScheduleAdjustRequestTable } from "@/components/requests/ScheduleAdjustRequestTable";
import { ProtectedPage } from "@/components/auth/ProtectedPage";

export default function ScheduleChangeListPage() {
  const router = useRouter();
  const { data: list, isLoading } = useScheduleAdjustList();
  const [activeTab, setActiveTab] = useState("pending");

  const pending = list ? list.filter((r) => r.ScaSstatus === 0 || r.ScaSstatus === 4) : [];
  const approved = list ? list.filter((r) => r.ScaSstatus === 1) : [];
  const rejected = list ? list.filter((r) => r.ScaSstatus === 2 || r.ScaSstatus === 3) : [];

  return (
    <ProtectedPage routeKey="requestScheduleChange">
    <div className="container mx-auto mt-4 mb-5 pb-5 pt-4 px-4">
      <div className="request-section">
        <div className="header-container mb-4 flex justify-between items-center">
          <h3 className="text-xl font-semibold text-bgc-text-highlight">Schedule Change</h3>
          <Button onClick={() => router.push("/request/schedule-change/apply")} variant="outline" size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Add Schedule Change
          </Button>
        </div>

        <Card className="mt-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="pending" className="flex items-center gap-2">
                <Hourglass className="w-4 h-4" />
                Submissions Pending Approval
              </TabsTrigger>
              <TabsTrigger value="approved" className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Approved
              </TabsTrigger>
              <TabsTrigger value="rejected" className="flex items-center gap-2">
                <XCircle className="w-4 h-4" />
                Disapproved and Cancelled
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="mt-4">
              <ScheduleAdjustRequestTable
                schedules={pending}
                isLoading={isLoading || list === undefined}
                status="pending"
              />
            </TabsContent>
            <TabsContent value="approved" className="mt-4">
              <ScheduleAdjustRequestTable
                schedules={approved}
                isLoading={isLoading || list === undefined}
                status="approved"
              />
            </TabsContent>
            <TabsContent value="rejected" className="mt-4">
              <ScheduleAdjustRequestTable
                schedules={rejected}
                isLoading={isLoading || list === undefined}
                status="rejected"
              />
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
    </ProtectedPage>
  );
}

