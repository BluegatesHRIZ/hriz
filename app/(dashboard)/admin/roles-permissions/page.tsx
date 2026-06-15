"use client";

export const dynamic = "force-dynamic";

import { ProtectedPage } from "@/components/auth/ProtectedPage";
import { RoleManagementTable } from "@/components/admin/RoleManagementTable";

export default function RolesPermissionsPage() {
  return (
    <ProtectedPage routeKey="adminRolesPermissions">
      <div className="container mx-auto mt-4 mb-5 pb-5 pt-4 px-4">
        <RoleManagementTable />
      </div>
    </ProtectedPage>
  );
}
