-- Add commitSha so every EvaluationRun is bound to a specific git commit,
-- allowing /api/compare to compute before/after diffs on any pull request.
ALTER TABLE "EvaluationRun"
  ADD COLUMN IF NOT EXISTS "commitSha" TEXT NOT NULL DEFAULT 'unknown';

CREATE INDEX IF NOT EXISTS "EvaluationRun_commitSha_idx" ON "EvaluationRun"("commitSha");
