"use client";

export const dynamic = "force-dynamic";

import { ProtectedPage } from "@/components/auth/ProtectedPage";
import { PhicContributionTable } from "@/components/contributions/PhicContributionTable";

export default function PhicContributionPage() {
  return (
    <ProtectedPage routeKey="contributionPhic">
      <PhicContributionTable />
    </ProtectedPage>
  );
}
