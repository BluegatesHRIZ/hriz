/** Read-only dump of the menu table, for diagnosing sidebar link problems. */
import "dotenv/config";
import mariadb from "mariadb";

async function main() {
  const p = new URL(process.env.DATABASE_URL!);
  const conn = await mariadb.createConnection({
    host: p.hostname,
    port: p.port ? parseInt(p.port) : 3306,
    user: p.username,
    password: decodeURIComponent(p.password),
    database: p.pathname.slice(1),
  });
  try {
    const rows = await conn.query(
      "SELECT mnu_id, mnu_desc, mnu_http, mnu_status, mnu_ctr FROM menu ORDER BY mnu_id",
    );
    console.table(rows);
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
