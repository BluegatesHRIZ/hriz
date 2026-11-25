/**
 * Repoints the report sidebar entries at their matching Next.js routes.
 *
 * R2..R5 had drifted one row out of step (Daily Logs pointed at /reports/leave,
 * Leave at /reports/overtime, and so on), so this maps each menu id explicitly
 * rather than pattern-matching on the description.
 *
 * Usage:
 *   pnpm tsx scripts/fix-report-menu-routes.ts
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

const MENU_ID_TO_PATH: Record<string, string> = {
  R1: "/reports/attendance",
  R2: "/reports/dailylog",
  R3: "/reports/leave",
  R4: "/reports/overtime",
  R5: "/reports/attendance-change",
  R6: "/reports/undertime",
  R7: "/reports/schedule-change",
  R8: "/reports/attendance-change",
  R9: "/reports/biolog",
};

async function main() {
  const conn = await mariadb.createConnection(parseConnectionString(DATABASE_URL!));

  try {
    const before = await conn.query(
      "SELECT mnu_id, mnu_desc, mnu_http FROM menu WHERE mnu_id LIKE 'R%' ORDER BY mnu_ctr",
    );
    console.log("\n--- Before ---");
    console.table(before);

    console.log("\n--- Updating ---");
    for (const [id, path] of Object.entries(MENU_ID_TO_PATH)) {
      const result = await conn.query(
        "UPDATE menu SET mnu_http = ? WHERE mnu_id = ? AND (mnu_http IS NULL OR mnu_http <> ?)",
        [path, id, path],
      );
      const affected = Number(result.affectedRows ?? 0);
      console.log(affected > 0 ? `  ✓ ${id} → ${path}` : `  · ${id} already ${path}`);
    }

    const after = await conn.query(
      "SELECT mnu_id, mnu_desc, mnu_http FROM menu WHERE mnu_id LIKE 'R%' ORDER BY mnu_ctr",
    );
    console.log("\n--- After ---");
    console.table(after);
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
