"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReactNode } from "react";

interface ReportPageShellProps {
  title: string;
  description?: string;
  filters: ReactNode;
  children: ReactNode;
}

/**
 * Layout shared by every report page. Mirrors the C# attendance/leave/etc.
 * Razor pages: page header, filter card, then a card containing the table.
 */
export function ReportPageShell({
  title,
  description,
  filters,
  children,
}: ReportPageShellProps) {
  return (
    <div className="container mx-auto px-4 pt-4 pb-8">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-bgc-text-highlight">{title}</h1>
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent>{filters}</CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardContent className="pt-6 overflow-x-auto">{children}</CardContent>
      </Card>
    </div>
  );
}
