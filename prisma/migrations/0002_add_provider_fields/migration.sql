-- Add provider/category/strategy/costUsd fields to EvaluationRun so that
-- /api/evidence can read real per-provider benchmark results instead of
-- falling back to demo data.
ALTER TABLE "EvaluationRun"
  ADD COLUMN IF NOT EXISTS "provider"  TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS "category"  TEXT NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS "strategy"  TEXT NOT NULL DEFAULT 'adaptive',
  ADD COLUMN IF NOT EXISTS "costUsd"   DOUBLE PRECISION NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "EvaluationRun_provider_idx" ON "EvaluationRun"("provider");
CREATE INDEX IF NOT EXISTS "EvaluationRun_createdAt_idx" ON "EvaluationRun"("createdAt");
