"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useOvertimeList } from "@/lib/hooks/useRequestManagement";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, Hourglass, CheckCircle2, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { OvertimeRequestTable } from "@/components/requests/OvertimeRequestTable";
import { useAuth } from "@/lib/auth/context";
import { ProtectedPage } from "@/components/auth/ProtectedPage";

export default function OvertimeListPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: overtimeList, isLoading } = useOvertimeList();
  const [activeTab, setActiveTab] = useState("pending");

  const handleAddOvertime = () => {
    router.push("/request/overtime/apply");
  };

  const pendingOt = overtimeList
    ? overtimeList.filter((ot) => ot.otm_status === 0 || ot.otm_status === 4)
    : [];
  const approvedOt = overtimeList
    ? overtimeList.filter((ot) => ot.otm_status === 1)
    : [];
  const rejectedOt = overtimeList
    ? overtimeList.filter((ot) => ot.otm_status === 2 || ot.otm_status === 3)
    : [];

  const showLoading = overtimeList === undefined || isLoading;

  return (
    <ProtectedPage routeKey="requestOvertime">
    <div className="container mx-auto mt-4 mb-5 pb-5 pt-4 px-4">
      <div className="request-section">
        <div className="header-container mb-4 flex justify-between items-center">
          <div>
            <h3 className="text-xl font-semibold text-bgc-text-highlight">
              Overtime
            </h3>
          </div>
          <div>
            <Button onClick={handleAddOvertime} variant="outline" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Overtime
            </Button>
          </div>
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
              <OvertimeRequestTable
                overtimes={pendingOt}
                isLoading={showLoading}
                status="pending"
                userId={user?.name || ""}
              />
            </TabsContent>
            <TabsContent value="approved" className="mt-4">
              <OvertimeRequestTable
                overtimes={approvedOt}
                isLoading={showLoading}
                status="approved"
                userId={user?.name || ""}
              />
            </TabsContent>
            <TabsContent value="rejected" className="mt-4">
              <OvertimeRequestTable
                overtimes={rejectedOt}
                isLoading={showLoading}
                status="rejected"
                userId={user?.name || ""}
              />
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
    </ProtectedPage>
  );
}

