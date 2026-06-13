"use client";

import { ProtectedPage } from "@/components/auth/ProtectedPage";
import { DeviceManagementTable } from "@/components/admin/DeviceManagementTable";

export default function RegisterDevicePage() {
  return (
    <ProtectedPage routeKey="adminRegisterDevice">
      <div className="container mx-auto mt-4 mb-5 pb-5 pt-4 px-4">
        <h2 className="text-2xl font-semibold mb-6">Register Device</h2>
        <DeviceManagementTable />
      </div>
    </ProtectedPage>
  );
}
