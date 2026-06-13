/**
 * Raw MariaDB connection pool for stored procedure calls.
 *
 * Prisma's $queryRawUnsafe does not reliably handle CALL statements that
 * return result sets via the @prisma/adapter-mariadb driver. This pool
 * provides a direct `callProc` helper that properly handles multiple result
 * sets returned by MariaDB stored procedures.
 */
import mariadb from "mariadb";

function getConnectionConfig() {
  // @ts-ignore - Cloudflare runtime types
  const cloudflareContext = globalThis[Symbol.for("__cloudflare-context__")];
  if (cloudflareContext?.env?.HYPERDRIVE) {
    const hd = cloudflareContext.env.HYPERDRIVE;
    return {
      host: hd.host,
      port: hd.port,
      user: hd.user,
      password: hd.password,
      database: hd.database,
    };
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error("DATABASE_URL is not set");
  }
  const parsed = new URL(dbUrl);
  return {
    host: parsed.hostname,
    port: parsed.port ? parseInt(parsed.port) : 3306,
    user: parsed.username,
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.slice(1),
  };
}

const globalForPool = globalThis as unknown as {
  mariaPool: mariadb.Pool | undefined;
};

export function getPool(): mariadb.Pool {
  if (!globalForPool.mariaPool) {
    globalForPool.mariaPool = mariadb.createPool({
      ...getConnectionConfig(),
      connectionLimit: 5,
      multipleStatements: true,
    });
  }
  return globalForPool.mariaPool;
}

/**
 * Calls a stored procedure and returns the first result set as an array of
 * row objects. Handles MariaDB's multiple result-set response correctly.
 */
export async function callProc<T extends Record<string, unknown> = Record<string, unknown>>(
  sql: string,
  params?: unknown[],
): Promise<T[]> {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const result = await conn.query(sql, params);
    // MariaDB returns [resultSet1, resultSet2, ..., OkPacket] for CALL.
    // We want the first result set (array of rows).
    if (Array.isArray(result) && result.length > 0 && Array.isArray(result[0])) {
      return result[0] as T[];
    }
    // If it's already a flat array of rows (single result set)
    if (Array.isArray(result) && result.length > 0 && !Array.isArray(result[0]) && typeof result[0] === "object" && result[0] !== null && !("affectedRows" in result[0])) {
      return result as T[];
    }
    return [];
  } finally {
    conn.release();
  }
}

/**
 * Executes a stored procedure without returning a result set (for procs that
 * only perform DML). Equivalent to Prisma's $executeRawUnsafe.
 */
export async function execProc(sql: string, params?: unknown[]): Promise<void> {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.query(sql, params);
  } finally {
    conn.release();
  }
}
