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

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  })

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
