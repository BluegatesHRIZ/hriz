// Only import dotenv in development/local environments
if (process.env.NODE_ENV !== "production" && typeof process.env.DATABASE_URL === "undefined") {
  try {
    require("dotenv/config");
  } catch {
    // dotenv not available, continue without it
  }
}
import { PrismaClient } from "@prisma/client"
import { PrismaMariaDb } from "@prisma/adapter-mariadb"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Hyperdrive binding type (available in Cloudflare Workers env)
interface HyperdriveBinding {
  host: string;
  user: string;
  password: string;
  database: string;
  port: number;
  connectionString?: string;
}

// Get database connection string - construct from Hyperdrive binding or use DATABASE_URL
function getDatabaseUrl(hyperdrive?: HyperdriveBinding): string {
  // If Hyperdrive binding is provided, construct connection string from it
  if (hyperdrive) {
    const { host, user, password, database, port } = hyperdrive;
    const encodedPassword = encodeURIComponent(password);
    // Use mysql:// protocol - mariadb adapter works with MySQL databases
    return `mysql://${user}:${encodedPassword}@${host}:${port}/${database}`;
  }
  
  // Try to access Hyperdrive from Cloudflare context (if available)
  // @ts-ignore - Cloudflare runtime types
  const cloudflareContext = globalThis[Symbol.for("__cloudflare-context__")];
  if (cloudflareContext?.env?.HYPERDRIVE) {
    const hd = cloudflareContext.env.HYPERDRIVE;
    const encodedPassword = encodeURIComponent(hd.password);
    return `mysql://${hd.user}:${encodedPassword}@${hd.host}:${hd.port}/${hd.database}`;
  }
  
  // Fallback to DATABASE_URL environment variable
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error("DATABASE_URL environment variable is not set and Hyperdrive binding is not available");
  }
  return dbUrl;
}

// Parse connection string into connection options
function parseConnectionString(url: string): { host: string; port: number; user: string; password: string; database: string } {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parsed.port ? parseInt(parsed.port) : 3306,
    user: parsed.username,
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.slice(1), // Remove leading '/'
  };
}

// Factory function to create Prisma client with adapter (required for Cloudflare Workers)
// According to Prisma docs: In edge environments, create Prisma Client per request
export function createPrismaClient(hyperdrive?: HyperdriveBinding): PrismaClient {
  let connectionConfig: { host: string; port: number; user: string; password: string; database: string };
  
  if (hyperdrive) {
    // Use Hyperdrive binding directly
    connectionConfig = {
      host: hyperdrive.host,
      port: hyperdrive.port,
      user: hyperdrive.user,
      password: hyperdrive.password,
      database: hyperdrive.database,
    };
  } else {
    // Try to access Hyperdrive from Cloudflare context (if available)
    // @ts-ignore - Cloudflare runtime types
    const cloudflareContext = globalThis[Symbol.for("__cloudflare-context__")];
    if (cloudflareContext?.env?.HYPERDRIVE) {
      const hd = cloudflareContext.env.HYPERDRIVE;
      connectionConfig = {
        host: hd.host,
        port: hd.port,
        user: hd.user,
        password: hd.password,
        database: hd.database,
      };
    } else {
      // Parse DATABASE_URL
      const dbUrl = process.env.DATABASE_URL;
      if (!dbUrl) {
        throw new Error("DATABASE_URL environment variable is not set and Hyperdrive binding is not available");
      }
      connectionConfig = parseConnectionString(dbUrl);
    }
  }
  
  // Create adapter with connection options (PrismaMariaDb doesn't accept connectionString)
  const adapter = new PrismaMariaDb({
    host: connectionConfig.host,
    port: connectionConfig.port,
    user: connectionConfig.user,
    password: connectionConfig.password,
    database: connectionConfig.database,
    connectionLimit: 5,
  });
  
  // Create Prisma Client with adapter (required for Cloudflare Workers)
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });
}

// Default export for backward compatibility (uses DATABASE_URL)
// Note: In Cloudflare Workers, create a new client per request using createPrismaClient(env.HYPERDRIVE)
export const prisma =
  globalForPrisma.prisma ??
  createPrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
