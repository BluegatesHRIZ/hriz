"use client";

import * as React from "react";
import Image from "next/image";
import { User } from "lucide-react";
import { cn } from "@/lib/utils";

/** "Juan Dela Cruz" -> "JD". Empty string when there's nothing to work with. */
export function initialsOf(name?: string | null): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "";
  return (first + last).toUpperCase();
}

export interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Public storage URL. Null/undefined renders the initials fallback. */
  src?: string | null;
  /** Used for the initials fallback and the image alt text. */
  name?: string | null;
  /** Rendered pixel size — also drives next/image's `sizes` hint. */
  size?: number;
  /** Rounding, so tables can use squircles and the sidebar can use circles. */
  rounded?: string;
}

/**
 * Profile picture with a graceful fallback chain: image -> initials -> icon.
 *
 * A `src` that 404s (file deleted from the bucket, stale DB row) falls back to
 * initials rather than showing a broken-image glyph, so a half-migrated bucket
 * still renders a clean list.
 */
export function Avatar({
  src,
  name,
  size = 36,
  rounded = "rounded-lg",
  className,
  ...props
}: AvatarProps) {
  // Remember *which* src failed rather than a bare flag, so a recycled row
  // (pagination, filter change) retries its new src without an effect.
  const [failedSrc, setFailedSrc] = React.useState<string | null>(null);

  const initials = initialsOf(name);
  const showImage = Boolean(src) && src !== failedSrc;

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden",
        "bg-muted ring-1 ring-border text-muted-foreground",
        "text-xs font-medium uppercase tracking-wide select-none",
        rounded,
        className,
      )}
      style={{ width: size, height: size }}
      {...props}
    >
      {showImage ? (
        <Image
          src={src as string}
          alt={name ? `${name}` : "Profile picture"}
          fill
          sizes={`${size}px`}
          className="object-cover"
          onError={() => setFailedSrc(src ?? null)}
        />
      ) : initials ? (
        <span aria-hidden="true">{initials}</span>
      ) : (
        <User aria-hidden="true" style={{ width: size * 0.5, height: size * 0.5 }} />
      )}
    </span>
  );
}
