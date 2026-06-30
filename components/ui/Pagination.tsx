"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PageMeta } from "@/lib/pagination";

interface PaginationProps {
  /** Pagination metadata returned by a server-side paginated endpoint. */
  meta: Pick<PageMeta, "total" | "page" | "limit" | "pageCount">;
  /** Called with the next page number when the user navigates. */
  onPageChange: (page: number) => void;
  className?: string;
}

/**
 * Shared pagination control for server-side paginated tables.
 * Renders a "Showing X to Y of N" summary plus prev/next buttons.
 */
export function Pagination({ meta, onPageChange, className }: PaginationProps) {
  const { total, page, limit, pageCount } = meta;
  if (total <= 0) return null;

  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div
      className={`flex items-center justify-between mt-4 pt-4 border-t ${className ?? ""}`}
    >
      <div className="text-xs text-muted-foreground">
        Showing {from} to {to} of {total} records
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="text-sm text-foreground">
          Page {page} of {pageCount}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.min(pageCount, page + 1))}
          disabled={page >= pageCount}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
