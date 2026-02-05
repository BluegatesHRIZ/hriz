// Only import dotenv in development/local environments
if (process.env.NODE_ENV !== "production" && typeof process.env.DATABASE_URL === "undefined") {
  try {
    require("dotenv/config");
  } catch {
    // dotenv not available, continue without it
  }
}
import { PrismaClient } from "@prisma/client"

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

// Get database URL - construct from Hyperdrive binding or use DATABASE_URL
function getDatabaseUrl(hyperdrive?: HyperdriveBinding): string {
  // If Hyperdrive binding is provided, construct connection string from it
  if (hyperdrive) {
    // Hyperdrive provides connection properties, construct MySQL connection string
    const { host, user, password, database, port } = hyperdrive;
    // URL encode password in case it contains special characters
    const encodedPassword = encodeURIComponent(password);
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

// Factory function to create Prisma client with optional Hyperdrive binding
export function createPrismaClient(hyperdrive?: HyperdriveBinding) {
  return new PrismaClient({
    datasources: {
      db: {
        url: getDatabaseUrl(hyperdrive),
      },
    },
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });
}

// Default export for backward compatibility (uses DATABASE_URL)
// Note: In Cloudflare Workers, you should use createPrismaClient(env.HYPERDRIVE) instead
export const prisma =
  globalForPrisma.prisma ??
  createPrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
