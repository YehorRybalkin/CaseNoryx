import "server-only";
import { PrismaClient } from "@prisma/client";

// Fall back to the default local database if .env was not created (e.g. `cp` skipped on Windows).
process.env.DATABASE_URL ||= "file:./dev.db";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"] });
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
