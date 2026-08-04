/**
 * Provisions the Schedule Management module on the live database:
 *   - creates the saved-template tables (scheduletemplate, scheduletemplatedetail)
 *   - adds the idx_schedule_emp index used by the bulk read/write paths
 *   - inserts the A11 "Manage Schedules" sidebar menu row (-> /schedules)
 *
 * All statements are idempotent (IF NOT EXISTS / ON DUPLICATE KEY), so this is
 * safe to re-run. Mirrors the existing menu scripts under sql/.
 *
 * Usage:
 *   npx tsx scripts/add-schedule-module.ts
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

const STATEMENTS: Array<{ label: string; sql: string }> = [
  {
    label: "create table scheduletemplate",
    sql: `CREATE TABLE IF NOT EXISTS scheduletemplate (
      sct_tid      VARCHAR(20)  NOT NULL,
      sct_tname    VARCHAR(60)  NOT NULL,
      sct_tdesc    VARCHAR(150) NULL,
      sct_tby      VARCHAR(6)   NULL,
      sct_tstatus  INT          NULL DEFAULT 1,
      sct_tlogdate DATETIME     NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (sct_tid)
    )`,
  },
  {
    label: "create table scheduletemplatedetail",
    sql: `CREATE TABLE IF NOT EXISTS scheduletemplatedetail (
      sct_did    VARCHAR(40) NOT NULL,
      sct_dpk    VARCHAR(20) NOT NULL,
      sct_dday   VARCHAR(45) NULL,
      sct_din    TIME        NULL,
      sct_dout   TIME        NULL,
      sct_dbin   TIME        NULL,
      sct_dbout  TIME        NULL,
      sct_dhrs   FLOAT       NULL DEFAULT 0,
      sct_drest  INT         NULL DEFAULT 0,
      sct_dshift VARCHAR(2)  NULL DEFAULT 'R',
      sct_dbreak TINYINT     NULL DEFAULT 1,
      PRIMARY KEY (sct_did)
    )`,
  },
  {
    label: "insert A11 Manage Schedules menu row",
    sql: `INSERT INTO menu (mnu_id, mnu_desc, mnu_status, mnu_http, mnu_ctr)
          VALUES ('A11', 'Manage Schedules', 1, '/schedules', 11)
          ON DUPLICATE KEY UPDATE
            mnu_desc = VALUES(mnu_desc),
            mnu_status = VALUES(mnu_status),
            mnu_http = VALUES(mnu_http),
            mnu_ctr = VALUES(mnu_ctr)`,
  },
];

// Version-safe idempotent index creation (this MariaDB predates
// `CREATE INDEX IF NOT EXISTS`, which is 10.5+). Checks information_schema first.
const INDEXES: Array<{ name: string; table: string; column: string }> = [
  { name: "idx_scheduletemplatedetail_pk", table: "scheduletemplatedetail", column: "sct_dpk" },
  { name: "idx_schedule_emp", table: "schedule", column: "sch_emp" },
];

async function ensureIndex(
  conn: mariadb.Connection,
  database: string,
  { name, table, column }: { name: string; table: string; column: string },
) {
  const rows = await conn.query(
    `SELECT COUNT(*) AS c FROM information_schema.STATISTICS
     WHERE table_schema = ? AND table_name = ? AND index_name = ?`,
    [database, table, name],
  );
  const exists = Number(rows[0]?.c ?? 0) > 0;
  if (exists) {
    console.log(`  = ${name} (already exists)`);
    return;
  }
  await conn.query(`CREATE INDEX ${name} ON ${table} (${column})`);
  console.log(`  ✓ ${name}`);
}

async function main() {
  const config = parseConnectionString(DATABASE_URL!);
  const conn = await mariadb.createConnection({ ...config, connectTimeout: 15000 });

  try {
    console.log(`\nConnected to ${config.database} @ ${config.host}`);
    for (const { label, sql } of STATEMENTS) {
      await conn.query(sql);
      console.log(`  ✓ ${label}`);
    }

    for (const idx of INDEXES) {
      await ensureIndex(conn, config.database, idx);
    }

    console.log("\n--- Administration menu rows ---");
    const adminRows = await conn.query(
      "SELECT mnu_id, mnu_desc, mnu_http, mnu_status, mnu_ctr FROM menu WHERE mnu_id LIKE 'A%' ORDER BY mnu_ctr",
    );
    console.table(adminRows);

    console.log("Done!");
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
