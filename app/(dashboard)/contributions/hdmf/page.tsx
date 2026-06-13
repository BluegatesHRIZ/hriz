"use client";

import { ProtectedPage } from "@/components/auth/ProtectedPage";
import { HdmfContributionTable } from "@/components/contributions/HdmfContributionTable";

export default function HdmfContributionPage() {
  return (
    <ProtectedPage routeKey="contributionHdmf">
      <HdmfContributionTable />
    </ProtectedPage>
  );
}
