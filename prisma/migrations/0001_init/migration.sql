-- Initial persistence schema for Agent Eval Router
CREATE TABLE "EvaluationRun" (
  "id" TEXT NOT NULL,
  "externalId" TEXT NOT NULL,
  "task" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "selectedModel" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "quality" DOUBLE PRECISION NOT NULL,
  "latencyMs" INTEGER NOT NULL,
  "cost" DOUBLE PRECISION NOT NULL,
  "reliability" DOUBLE PRECISION NOT NULL,
  "candidatesJson" JSONB NOT NULL,
  "traceJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EvaluationRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EvaluationRun_externalId_key" ON "EvaluationRun"("externalId");

CREATE TABLE "EvaluationCase" (
  "id" TEXT NOT NULL,
  "task" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "difficulty" TEXT NOT NULL,
  "expectedOutput" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EvaluationCase_pkey" PRIMARY KEY ("id")
);
