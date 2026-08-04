/**
 * Adds the per-run "taxable earnings" flag to `pay_header`.
 *
 * WHY
 * ---
 * The legacy engine paid allowances, de minimis benefits and premiums in full
 * but left them OUT of the BIR withholding base — verified on two independent
 * databases:
 *
 *   bgc_ofc_hris  emp 000008  1,500 Allowance  (CD3) -> taxed on 12,550
 *   bgc_bgc_hris  emp 000001  1,500 De Minimis (CD4) -> taxed on 12,125
 *
 * `comded` marks both taxable (`cd_tax = 1`), so the config and the behaviour
 * disagree. Rather than the engine silently picking a side, each payroll run
 * now carries its own switch.
 *
 * `pyh_taxearn`:
 *   '0' (default) — legacy behaviour: tax base is basic minus statutory
 *   '1'           — add taxable earnings (allowances, de minimis, premiums)
 *
 * Defaults to '0' so existing runs recompute exactly as before.
 *
 * Idempotent — checks INFORMATION_SCHEMA first, so it is safe to re-run.
 *
 * Usage:
 *   npx tsx scripts/add-payroll-taxable-flag.ts           # dry run
 *   npx tsx scripts/add-payroll-taxable-flag.ts --apply   # write
 *
 * To reverse:  ALTER TABLE pay_header DROP COLUMN pyh_taxearn;
 */

import "dotenv/config";
import mariadb from "mariadb";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL is not set in .env");
  process.exit(1);
}

const APPLY = process.argv.includes("--apply");

const COLUMN = "pyh_taxearn";
const TABLE = "pay_header";
const DDL = `ALTER TABLE \`${TABLE}\` ADD COLUMN \`${COLUMN}\` VARCHAR(1) NULL DEFAULT '0' AFTER \`pyh_tax\``;

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
  const config = parseConnectionString(DATABASE_URL!);
  const conn = await mariadb.createConnection({ ...config, connectTimeout: 20000 });

  try {
    console.log(`database: ${config.database}`);
    console.log(APPLY ? "\n--- APPLYING ---" : "\n--- DRY RUN (pass --apply to write) ---");

    const existing = await conn.query(
      `SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT
         FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [config.database, TABLE, COLUMN],
    );

    if (existing.length > 0) {
      const c = existing[0];
      console.log(
        `  ${TABLE}.${COLUMN} already exists (${c.COLUMN_TYPE}, default ${c.COLUMN_DEFAULT}) — nothing to do`,
      );
      return;
    }

    console.log(`  ${TABLE}.${COLUMN} is missing — will add VARCHAR(1) NULL DEFAULT '0'`);
    if (!APPLY) {
      console.log("\nRe-run with --apply to write.");
      return;
    }

    await conn.query(DDL);
    // Backfill so no run carries a NULL the engine has to interpret.
    const res = await conn.query(
      `UPDATE \`${TABLE}\` SET \`${COLUMN}\` = '0' WHERE \`${COLUMN}\` IS NULL`,
    );
    console.log(`  column added; backfilled ${res.affectedRows} existing run(s) to '0'`);
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
