export const TOTAL_EXPERIMENT_CASES = 50;
export const MAX_EXPERIMENT_BATCH_SIZE = 10;

export type ExperimentBatch = Readonly<{
  start: number;
  limit: number;
}>;

export function normalizeExperimentBatch(startValue: number, limitValue: number): ExperimentBatch {
  if (!Number.isInteger(startValue) || startValue < 0 || startValue >= TOTAL_EXPERIMENT_CASES) {
    throw new Error(`Experiment start must be an integer from 0 to ${TOTAL_EXPERIMENT_CASES - 1}.`);
  }
  if (!Number.isInteger(limitValue) || limitValue <= 0 || limitValue > MAX_EXPERIMENT_BATCH_SIZE) {
    throw new Error(`Experiment limit must be an integer from 1 to ${MAX_EXPERIMENT_BATCH_SIZE}.`);
  }
  const start = Math.floor(startValue / MAX_EXPERIMENT_BATCH_SIZE) * MAX_EXPERIMENT_BATCH_SIZE;
  const remaining = TOTAL_EXPERIMENT_CASES - start;
  return { start, limit: Math.min(limitValue, remaining) };
}
