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

// Get database URL - prioritize Hyperdrive connection string, fallback to DATABASE_URL
function getDatabaseUrl(): string {
  // In production (Cloudflare), use HYPERDRIVE_CONNECTION_STRING if set
  // Otherwise fallback to DATABASE_URL
  const dbUrl = process.env.HYPERDRIVE_CONNECTION_STRING || process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error("DATABASE_URL or HYPERDRIVE_CONNECTION_STRING environment variable is not set");
  }
  return dbUrl;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: getDatabaseUrl(),
      },
    },
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  })

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
