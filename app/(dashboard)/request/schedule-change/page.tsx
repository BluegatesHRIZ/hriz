"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useScheduleAdjustList } from "@/lib/hooks/useRequestManagement";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, Hourglass, CheckCircle2, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ScheduleAdjustRequestTable } from "@/components/requests/ScheduleAdjustRequestTable";
import { Pagination } from "@/components/ui/Pagination";
import { ProtectedPage } from "@/components/auth/ProtectedPage";
import type { RequestStatusGroup } from "@/lib/requests/status";

export default function ScheduleChangeListPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<RequestStatusGroup>("pending");
  const [page, setPage] = useState(1);
  // Status filtering and pagination happen server-side; each tab fetches its own page.
  const { data, isLoading } = useScheduleAdjustList(activeTab, page);
  const rows = data?.data ?? [];
  const meta = data?.meta;

  const handleTabChange = (value: string) => {
    setActiveTab(value as RequestStatusGroup);
    setPage(1);
  };

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
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
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

            {/* Only the active tab is rendered/visible; it holds the fetched page. */}
            <TabsContent value={activeTab} className="mt-4">
              <ScheduleAdjustRequestTable
                schedules={rows}
                isLoading={isLoading}
                status={activeTab}
              />
              {meta && <Pagination meta={meta} onPageChange={setPage} />}
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
    </ProtectedPage>
  );
}
