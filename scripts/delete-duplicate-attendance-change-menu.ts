/**
 * Removes the duplicate "Attendance Change" report menu row (R8).
 *
 * R5 ("Attendance Change Report") already points at /reports/attendance-change,
 * and R8 pointed at the same route, so both rows highlighted as active at once.
 * R8 also has no entry in MENU_TO_PERMISSION_NAMES (only R1..R7 are defined),
 * which confirms it was added straight to the DB rather than being part of the
 * intended Reports accordion.
 *
 * The row is printed before deletion so it can be re-inserted if needed.
 *
 * Usage:
 *   pnpm tsx scripts/delete-duplicate-attendance-change-menu.ts
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

const TARGET_ID = "R8";
const EXPECTED_PATH = "/reports/attendance-change";

async function main() {
  const conn = await mariadb.createConnection(parseConnectionString(DATABASE_URL!));

  try {
    const rows = await conn.query(
      "SELECT mnu_id, mnu_desc, mnu_http, mnu_status, mnu_ctr FROM menu WHERE mnu_id = ?",
      [TARGET_ID],
    );

    if (rows.length === 0) {
      console.log(`${TARGET_ID} is already gone — nothing to do.`);
      return;
    }

    const row = rows[0];
    console.log("\n--- Row being deleted (keep this to restore it) ---");
    console.table(rows);
    console.log(
      `INSERT INTO menu (mnu_id, mnu_desc, mnu_status, mnu_http, mnu_ctr) VALUES ` +
        `('${row.mnu_id}', '${row.mnu_desc}', ${row.mnu_status}, '${row.mnu_http}', ${row.mnu_ctr});`,
    );

    // Guard against deleting a row someone has since repurposed for another page.
    if (row.mnu_http !== EXPECTED_PATH) {
      console.error(
        `\nABORTED: ${TARGET_ID} points at "${row.mnu_http}", not "${EXPECTED_PATH}". ` +
          `It is no longer the duplicate this script was written for.`,
      );
      process.exitCode = 1;
      return;
    }

    const result = await conn.query("DELETE FROM menu WHERE mnu_id = ?", [TARGET_ID]);
    console.log(`\nDeleted ${Number(result.affectedRows ?? 0)} row(s).`);

    const after = await conn.query(
      "SELECT mnu_id, mnu_desc, mnu_http, mnu_status FROM menu WHERE mnu_id LIKE 'R%' ORDER BY mnu_ctr",
    );
    console.log("\n--- Remaining report menu entries ---");
    console.table(after);
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
