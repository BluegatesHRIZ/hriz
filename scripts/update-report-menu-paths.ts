/**
 * Repoints the sidebar menu entries for reports at the new Next.js routes.
 *
 * Usage:
 *   pnpm tsx scripts/update-report-menu-paths.ts
 *
 * Reads DATABASE_URL from .env automatically via dotenv.
 */

import "dotenv/config";
import mariadb from "mariadb";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL is not set in .env");
  process.exit(1);
}

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

/**
 * Maps menu descriptions to the correct Next.js paths.
 * Uses LIKE patterns on mnu_desc so it doesn't matter what the mnu_id is.
 */
const REPORT_DESC_TO_PATH: Array<{ pattern: string; path: string }> = [
  { pattern: "%Attendance Report%", path: "/reports/attendance" },
  { pattern: "%Leave Report%", path: "/reports/leave" },
  { pattern: "%Overtime Report%", path: "/reports/overtime" },
  { pattern: "%Daily%Log%", path: "/reports/dailylog" },
  { pattern: "%Payroll%", path: "/reports/payroll" },
  { pattern: "%Undertime%Report%", path: "/reports/undertime" },
  { pattern: "%Schedule%Change%Report%", path: "/reports/schedule-change" },
  { pattern: "%Attendance%Change%Report%", path: "/reports/attendance-change" },
  { pattern: "%Biolog%", path: "/reports/biolog" },
];

const CONTRIBUTION_DESC_TO_PATH: Array<{ pattern: string; path: string }> = [
  { pattern: "%SSS%", path: "/contributions/sss" },
  { pattern: "%HDMF%", path: "/contributions/hdmf" },
  { pattern: "%Pag-IBIG%", path: "/contributions/hdmf" },
  { pattern: "%PHIC%", path: "/contributions/phic" },
  { pattern: "%PhilHealth%", path: "/contributions/phic" },
];

async function main() {
  const config = parseConnectionString(DATABASE_URL!);
  const conn = await mariadb.createConnection(config);

  try {
    console.log("\n--- Current report menu entries ---");
    const rows = await conn.query(
      "SELECT mnu_id, mnu_desc, mnu_http, mnu_status FROM menu WHERE mnu_id = 'H2' OR mnu_id LIKE 'R%' ORDER BY mnu_ctr",
    );
    console.table(rows);

    console.log("\n--- Updating report paths by description ---");
    for (const { pattern, path } of REPORT_DESC_TO_PATH) {
      const result = await conn.query(
        "UPDATE menu SET mnu_http = ? WHERE mnu_desc LIKE ? AND mnu_id LIKE 'R%'",
        [path, pattern],
      );
      const affected = result.affectedRows ?? 0;
      if (affected > 0) {
        console.log(`  ✓ "${pattern}" → ${path}`);
      } else {
        console.log(`  ⚠ No row matching "${pattern}" — skipped`);
      }
    }

    console.log("\n--- Updating contribution paths by description ---");
    for (const { pattern, path } of CONTRIBUTION_DESC_TO_PATH) {
      const result = await conn.query(
        "UPDATE menu SET mnu_http = ? WHERE mnu_desc LIKE ? AND mnu_id LIKE 'C%'",
        [path, pattern],
      );
      const affected = result.affectedRows ?? 0;
      if (affected > 0) {
        console.log(`  ✓ "${pattern}" → ${path}`);
      } else {
        console.log(`  ⚠ No row matching "${pattern}" — skipped`);
      }
    }

    console.log("\n--- Updated report menu entries ---");
    const updated = await conn.query(
      "SELECT mnu_id, mnu_desc, mnu_http, mnu_status FROM menu WHERE mnu_id = 'H2' OR mnu_id LIKE 'R%' ORDER BY mnu_ctr",
    );
    console.table(updated);

    console.log("\nDone!");
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
