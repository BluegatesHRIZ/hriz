"use client";

export const dynamic = "force-dynamic";

import { ProtectedPage } from "@/components/auth/ProtectedPage";
import { SettingsForm } from "@/components/admin/SettingsForm";

export default function SettingsPage() {
  return (
    <ProtectedPage routeKey="adminSettings">
      <div className="container mx-auto mt-4 mb-5 pb-5 pt-4 px-4">
        <SettingsForm />
      </div>
    </ProtectedPage>
  );
}
