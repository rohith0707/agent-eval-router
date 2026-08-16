import { execFileSync } from "node:child_process";

const url = process.env.DATABASE_URL
  ?? process.env.POSTGRES_PRISMA_URL
  ?? process.env.POSTGRES_URL
  ?? process.env.POSTGRES_URL_NON_POOLING;

if (url && !process.env.DATABASE_URL) process.env.DATABASE_URL = url;

if (process.env.DATABASE_URL) {
  console.log("[build] Database configured; applying Prisma migrations...");
  execFileSync("npx", ["prisma", "migrate", "deploy"], { stdio: "inherit", env: process.env });
} else {
  console.warn("[build] No database URL found; deploying without persistence. Add DATABASE_URL or a Vercel/Neon POSTGRES_* variable for saved evidence.");
}
