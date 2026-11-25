"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface MoneyInputProps
  extends Omit<React.ComponentProps<typeof Input>, "type" | "value" | "onChange"> {
  value: number | null | undefined;
  onValueChange: (value: number) => void;
  /** Classes for the wrapper, e.g. flex-1 when it sits in a flex row. */
  containerClassName?: string;
}

/**
 * Peso amount field: a ₱ prefix, right-aligned tabular digits, no spinner
 * arrows, and an empty box (placeholder 0.00) instead of a 0 the user has to
 * delete first. An empty box reports 0.
 */
export function MoneyInput({
  value,
  onValueChange,
  className,
  containerClassName,
  readOnly,
  placeholder = "0.00",
  ...props
}: MoneyInputProps) {
  return (
    <div className={cn("relative", containerClassName)}>
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
        ₱
      </span>
      <Input
        type="number"
        inputMode="decimal"
        step="0.01"
        min="0"
        placeholder={placeholder}
        value={value ? value : ""}
        onChange={(e) => {
          const n = parseFloat(e.target.value);
          onValueChange(Number.isFinite(n) ? n : 0);
        }}
        readOnly={readOnly}
        className={cn(
          "tabular pl-7 text-right [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
          readOnly && "bg-muted",
          className,
        )}
        {...props}
      />
    </div>
  );
}
