"use client";

import { ProtectedPage } from "@/components/auth/ProtectedPage";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BulkUploadTab } from "@/components/admin/BulkUploadTab";

export default function BulkUploadPage() {
  return (
    <ProtectedPage routeKey="adminBulkUpload">
      <div className="container mx-auto mt-4 mb-5 pb-5 pt-4 px-4">
        <h2 className="text-2xl font-semibold mb-6">Bulk Upload</h2>

        <Tabs defaultValue="employees">
          <TabsList className="mb-4">
            <TabsTrigger value="employees">Employees</TabsTrigger>
            <TabsTrigger value="schedules">Schedules</TabsTrigger>
          </TabsList>

          <TabsContent value="employees">
            <BulkUploadTab
              type="employees"
              title="Employee Bulk Upload"
              description="Upload an Excel file (.xlsx) to create multiple employees at once. Download the template to see the required column format."
            />
          </TabsContent>

          <TabsContent value="schedules">
            <BulkUploadTab
              type="schedules"
              title="Schedule Bulk Assignment"
              description="Upload an Excel file (.xlsx) to validate schedule assignments for multiple employees. Download the template for the required format."
            />
          </TabsContent>
        </Tabs>
      </div>
    </ProtectedPage>
  );
}
