"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLoanList } from "@/lib/hooks/useRequestManagement";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, Hourglass, CheckCircle2, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { LoanRequestTable } from "@/components/requests/LoanRequestTable";
import { ProtectedPage } from "@/components/auth/ProtectedPage";

export default function LoanListPage() {
  const router = useRouter();
  const { data: loanList, isLoading } = useLoanList();
  const [activeTab, setActiveTab] = useState("pending");

  const pending = loanList
    ? loanList.filter((loan) => loan.LoaStatus === 0 || loan.LoaStatus === 4)
    : [];
  const approved = loanList ? loanList.filter((loan) => loan.LoaStatus === 1) : [];
  const rejected = loanList
    ? loanList.filter((loan) => loan.LoaStatus === 2 || loan.LoaStatus === 3)
    : [];

  const showLoading = loanList === undefined || isLoading;

  return (
    <ProtectedPage routeKey="requestLoan">
    <div className="container mx-auto mt-4 mb-5 pb-5 pt-4 px-4">
      <div className="request-section">
        <div className="header-container mb-4 flex justify-between items-center">
          <h3 className="text-xl font-semibold text-bgc-text-highlight">Loan</h3>
          <Button onClick={() => router.push("/request/loan/apply")} variant="outline" size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Add Loan
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
              <LoanRequestTable loans={pending} isLoading={showLoading} status="pending" />
            </TabsContent>
            <TabsContent value="approved" className="mt-4">
              <LoanRequestTable loans={approved} isLoading={showLoading} status="approved" />
            </TabsContent>
            <TabsContent value="rejected" className="mt-4">
              <LoanRequestTable loans={rejected} isLoading={showLoading} status="rejected" />
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
    </ProtectedPage>
  );
}

