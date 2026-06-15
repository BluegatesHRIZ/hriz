"use client";

export const dynamic = "force-dynamic";

import { ProtectedPage } from "@/components/auth/ProtectedPage";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DepartmentTab, LocationTab, PositionTab, LeaveTypeTab } from "@/components/admin/MasterfileTab";

export default function MasterfilePage() {
  return (
    <ProtectedPage routeKey="adminMasterfile">
      <div className="container mx-auto mt-4 mb-5 pb-5 pt-4 px-4">
        <h2 className="text-2xl font-semibold mb-6">Masterfile Maintenance</h2>

        <Tabs defaultValue="departments">
          <TabsList className="mb-4">
            <TabsTrigger value="departments">Departments</TabsTrigger>
            <TabsTrigger value="locations">Locations</TabsTrigger>
            <TabsTrigger value="positions">Positions</TabsTrigger>
            <TabsTrigger value="leave-types">Leave Types</TabsTrigger>
          </TabsList>

          <TabsContent value="departments"><DepartmentTab /></TabsContent>
          <TabsContent value="locations"><LocationTab /></TabsContent>
          <TabsContent value="positions"><PositionTab /></TabsContent>
          <TabsContent value="leave-types"><LeaveTypeTab /></TabsContent>
        </Tabs>
      </div>
    </ProtectedPage>
  );
}
