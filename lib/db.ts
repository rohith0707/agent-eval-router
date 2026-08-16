import { PrismaClient } from "@prisma/client";
import { getDatabaseUrl } from "@/lib/config";

// Prisma's schema is hard-coded to DATABASE_URL. Vercel/Neon can expose
// equivalent connection strings under POSTGRES_* names, so normalize them
// before PrismaClient is constructed.
const databaseUrl = getDatabaseUrl();
if (databaseUrl && !process.env.DATABASE_URL) process.env.DATABASE_URL = databaseUrl;

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const db = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

export function databaseConfigured() {
  return Boolean(getDatabaseUrl());
}
