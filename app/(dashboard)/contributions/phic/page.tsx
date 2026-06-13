"use client";

import { ProtectedPage } from "@/components/auth/ProtectedPage";
import { PhicContributionTable } from "@/components/contributions/PhicContributionTable";

export default function PhicContributionPage() {
  return (
    <ProtectedPage routeKey="contributionPhic">
      <PhicContributionTable />
    </ProtectedPage>
  );
}
