import { PrismaClient } from "@prisma/client";

// Vercel's Neon integration can expose different connection-variable names
// depending on how the integration was installed. Prisma uses DATABASE_URL,
// so normalize the common Neon/Vercel names before constructing the client.
if (!process.env.DATABASE_URL) {
  const fallbackUrl =
    process.env.POSTGRES_PRISMA_URL ??
    process.env.POSTGRES_URL ??
    process.env.POSTGRES_URL_NON_POOLING;

  if (fallbackUrl) process.env.DATABASE_URL = fallbackUrl;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const db = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
