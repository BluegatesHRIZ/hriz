// Only import dotenv in development/local environments
if (process.env.NODE_ENV !== "production" && typeof process.env.DATABASE_URL === "undefined") {
  try {
    require("dotenv/config");
  } catch {
    // dotenv not available, continue without it
  }
}
import { PrismaClient } from "@prisma/client"
import { PrismaMariaDB } from "@prisma/adapter-mariadb"

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

// Factory function to create Prisma client with adapter (required for Cloudflare Workers)
// According to Prisma docs: In edge environments, create Prisma Client per request
export function createPrismaClient(hyperdrive?: HyperdriveBinding): PrismaClient {
  const connectionString = getDatabaseUrl(hyperdrive);
  
  // Create adapter with connection string (similar to PrismaPg in docs)
  const adapter = new PrismaMariaDB({
    connectionString,
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
