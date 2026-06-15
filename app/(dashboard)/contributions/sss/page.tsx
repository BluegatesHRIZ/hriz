"use client";

export const dynamic = "force-dynamic";

import { ProtectedPage } from "@/components/auth/ProtectedPage";
import { SssContributionTable } from "@/components/contributions/SssContributionTable";

export default function SssContributionPage() {
  return (
    <ProtectedPage routeKey="contributionSss">
      <SssContributionTable />
    </ProtectedPage>
  );
}
