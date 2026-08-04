/**
 * Repoints the Payroll sidebar entries at the Next.js routes.
 *
 * Both payroll menu rows still carry the legacy `hriz/` prefix, which
 * `normalizeHref` in `components/layout/Sidebar.tsx` turns into a bad absolute
 * path, so both 404:
 *
 *   PR1  Run Payroll     hriz/payroll          -> /hriz/payroll          404
 *   PR2  Payroll Report  hriz/reports/payroll  -> /hriz/reports/payroll  404
 *
 * After this script:
 *
 *   PR1  Run Payroll     /payroll          (the module in app/(dashboard)/payroll)
 *   PR2  Payroll Report  /reports/payroll  (already existed; just mispointed)
 *
 * Targets rows by `mnu_id` rather than by description, because
 * `scripts/update-report-menu-paths.ts` matches `%Payroll%` and would otherwise
 * drag "Run Payroll" onto the report page too.
 *
 * Idempotent — safe to re-run. Prints before/after and only writes rows whose
 * path actually differs.
 *
 * Usage:
 *   npx tsx scripts/fix-payroll-menu-paths.ts           # dry run
 *   npx tsx scripts/fix-payroll-menu-paths.ts --apply   # write
 */

import "dotenv/config";
import mariadb from "mariadb";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL is not set in .env");
  process.exit(1);
}

const APPLY = process.argv.includes("--apply");

const MENU_PATHS: Array<{ id: string; path: string; label: string }> = [
  { id: "PR1", path: "/payroll", label: "Run Payroll" },
  { id: "PR2", path: "/reports/payroll", label: "Payroll Report" },
];

function parseConnectionString(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parsed.port ? parseInt(parsed.port) : 3306,
    user: parsed.username,
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.slice(1),
  };
}

async function main() {
  const conn = await mariadb.createConnection({
    ...parseConnectionString(DATABASE_URL!),
    connectTimeout: 20000,
  });

  try {
    console.log(APPLY ? "\n--- APPLYING ---" : "\n--- DRY RUN (pass --apply to write) ---");

    let changed = 0;
    for (const { id, path, label } of MENU_PATHS) {
      const rows = await conn.query(
        "SELECT mnu_id, mnu_desc, mnu_http FROM menu WHERE mnu_id = ?",
        [id],
      );
      if (rows.length === 0) {
        console.log(`  ${id} (${label}): no such menu row — skipped`);
        continue;
      }

      const current = rows[0].mnu_http;
      if (current === path) {
        console.log(`  ${id} (${rows[0].mnu_desc}): already "${path}" — unchanged`);
        continue;
      }

      console.log(`  ${id} (${rows[0].mnu_desc}): "${current}" -> "${path}"`);
      if (APPLY) {
        await conn.query("UPDATE menu SET mnu_http = ? WHERE mnu_id = ?", [path, id]);
      }
      changed += 1;
    }

    console.log(
      APPLY
        ? `\nUpdated ${changed} menu row(s).`
        : `\n${changed} row(s) would change. Re-run with --apply to write.`,
    );
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
