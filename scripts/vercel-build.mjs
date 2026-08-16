import { execFileSync } from "node:child_process";

// Normalize Vercel/Neon connection-variable names for Prisma tooling.
const url = process.env.DATABASE_URL
  ?? process.env.POSTGRES_PRISMA_URL
  ?? process.env.POSTGRES_URL
  ?? process.env.POSTGRES_URL_NON_POOLING;

if (url && !process.env.DATABASE_URL) process.env.DATABASE_URL = url;

// Deployments should compile independently of database availability. Running
// migrations during a build makes a transient DB/network issue fail the whole
// deployment. Use RUN_DB_MIGRATIONS=1 for an explicit migration deployment.
if (process.env.RUN_DB_MIGRATIONS === "1") {
  if (!process.env.DATABASE_URL) {
    throw new Error("RUN_DB_MIGRATIONS=1 but DATABASE_URL is not configured");
  }
  console.log("[build] RUN_DB_MIGRATIONS=1; applying Prisma migrations...");
  execFileSync("npx", ["prisma", "migrate", "deploy"], { stdio: "inherit", env: process.env });
} else {
  console.log("[build] Skipping Prisma migrations during build; run them explicitly with RUN_DB_MIGRATIONS=1");
}
