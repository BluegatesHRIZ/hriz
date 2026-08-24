import { prisma } from "@/lib/db/prisma";
import { storageService } from "@/lib/storage";

/**
 * Profile picture lookup.
 *
 * Profile pictures live in the `files` table as `fil_type = "profile"` rows
 * pointing at Supabase Storage. The DB column is VARCHAR(45) and stores the
 * legacy C# shape `./201/{path}/{filename}`, while the storage key is just
 * `{path}/{filename}`.
 */

/**
 * The uploader writes "profile"; "emp_profile" is the legacy C# spelling that
 * older rows may still carry. Read both so pre-existing photos keep showing.
 */
export const PROFILE_FILE_TYPES = ["profile", "emp_profile"];

/** `./201/employee/ab12.jpg` -> `employee/ab12.jpg`. */
export function toStorageKey(filPath: string): string {
  return filPath.replace(/^\.\/201\//, "");
}

/**
 * Resolve profile picture URLs for a batch of employees.
 *
 * One query for the whole page: building a public URL is pure string
 * concatenation (`getPublicUrl` does no network I/O), so the cost here is the
 * single `files` lookup rather than one round trip per row. Employees without
 * a picture are simply absent from the map — callers fall back to initials.
 */
export async function getAvatarUrls(
  empIds: string[],
): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  const ids = [...new Set(empIds.filter(Boolean))];
  if (!ids.length) return urls;

  const rows = await prisma.files.findMany({
    where: { fil_fk: { in: ids }, fil_type: { in: PROFILE_FILE_TYPES } },
    select: { fil_fk: true, fil_path: true, fil_status: true },
    orderBy: { fil_datetime: "desc" },
  });

  for (const row of rows) {
    // Superseded uploads are flagged 0; legacy C# rows leave the column null.
    if (row.fil_status === 0) continue;
    // Newest-first, so the first surviving row per employee is the current one.
    if (urls.has(row.fil_fk)) continue;
    try {
      urls.set(
        row.fil_fk,
        await storageService.getFileUrl(toStorageKey(row.fil_path)),
      );
    } catch {
      // One unreadable path shouldn't blank out everyone else's avatar.
    }
  }

  return urls;
}

/** Single-employee convenience wrapper around {@link getAvatarUrls}. */
export async function getAvatarUrl(empId: string): Promise<string | null> {
  const urls = await getAvatarUrls([empId]);
  return urls.get(empId) ?? null;
}
