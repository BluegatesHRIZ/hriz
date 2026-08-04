"use client";

import { CalendarClock, LayoutGrid, Users } from "lucide-react";
import { CardWithHeader } from "@/components/cards/CardWithHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BulkApplyPanel } from "./BulkApplyPanel";
import { ScheduleGridPanel } from "./ScheduleGridPanel";

/**
 * Schedule Management module. Two modes:
 *  - Bulk Apply: build one weekly schedule and apply it to many employees.
 *  - Grid: review/fine-tune individual employees' weekly schedules.
 * Both edit the recurring weekly template (the `schedule` table).
 */
export function ScheduleManager() {
  return (
    <div className="w-full px-4 md:px-6 lg:px-8 pt-5 pb-8">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold text-foreground">
          Manage Schedules
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Set employees&apos; weekly work schedules in bulk, or fine-tune them
          one at a time.
        </p>
      </div>

      <CardWithHeader
        title="Employee Schedules"
        icon={<CalendarClock />}
      >
        <Tabs defaultValue="bulk" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="bulk" className="gap-1.5">
              <Users className="h-4 w-4" /> Bulk Apply
            </TabsTrigger>
            <TabsTrigger value="grid" className="gap-1.5">
              <LayoutGrid className="h-4 w-4" /> Grid
            </TabsTrigger>
          </TabsList>
          <TabsContent value="bulk">
            <BulkApplyPanel />
          </TabsContent>
          <TabsContent value="grid">
            <ScheduleGridPanel />
          </TabsContent>
        </Tabs>
      </CardWithHeader>
    </div>
  );
}
