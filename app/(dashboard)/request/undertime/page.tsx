"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUndertimeList } from "@/lib/hooks/useRequestManagement";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, Hourglass, CheckCircle2, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { UndertimeRequestTable } from "@/components/requests/UndertimeRequestTable";
import { ProtectedPage } from "@/components/auth/ProtectedPage";

export default function UndertimeListPage() {
  const router = useRouter();
  const { data: undertimeList, isLoading } = useUndertimeList();
  const [activeTab, setActiveTab] = useState("pending");

  const pending = undertimeList
    ? undertimeList.filter((ut) => ut.UtmStatus === 0 || ut.UtmStatus === 4)
    : [];
  const approved = undertimeList
    ? undertimeList.filter((ut) => ut.UtmStatus === 1)
    : [];
  const rejected = undertimeList
    ? undertimeList.filter((ut) => ut.UtmStatus === 2 || ut.UtmStatus === 3)
    : [];

  const showLoading = undertimeList === undefined || isLoading;

  return (
    <ProtectedPage routeKey="requestUndertime">
    <div className="container mx-auto mt-4 mb-5 pb-5 pt-4 px-4">
      <div className="request-section">
        <div className="header-container mb-4 flex justify-between items-center">
          <div>
            <h3 className="text-xl font-semibold text-bgc-text-highlight">Undertime</h3>
          </div>
          <div>
            <Button
              onClick={() => router.push("/request/undertime/apply")}
              variant="outline"
              size="sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Undertime
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
              <UndertimeRequestTable
                undertimes={pending}
                isLoading={showLoading}
                status="pending"
              />
            </TabsContent>
            <TabsContent value="approved" className="mt-4">
              <UndertimeRequestTable
                undertimes={approved}
                isLoading={showLoading}
                status="approved"
              />
            </TabsContent>
            <TabsContent value="rejected" className="mt-4">
              <UndertimeRequestTable
                undertimes={rejected}
                isLoading={showLoading}
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

