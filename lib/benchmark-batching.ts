export const TOTAL_BENCHMARK_CASES = 50;
export const MAX_BENCHMARK_BATCH_SIZE = 5;

export type BenchmarkBatch = {
  start: number;
  limit: number;
};

export function normalizeBenchmarkBatch(startInput: number, limitInput: number): BenchmarkBatch {
  if (!Number.isInteger(startInput) || startInput < 0 || startInput >= TOTAL_BENCHMARK_CASES) {
    throw new Error(`Benchmark start must be an integer from 0 to ${TOTAL_BENCHMARK_CASES - 1}`);
  }
  if (!Number.isInteger(limitInput) || limitInput < 1 || limitInput > MAX_BENCHMARK_BATCH_SIZE) {
    throw new Error(`Benchmark batch size must be an integer from 1 to ${MAX_BENCHMARK_BATCH_SIZE}`);
  }
  return {
    start: startInput,
    limit: Math.min(limitInput, TOTAL_BENCHMARK_CASES - startInput),
  };
}

export function createBenchmarkBatches(batchSize = MAX_BENCHMARK_BATCH_SIZE): BenchmarkBatch[] {
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > MAX_BENCHMARK_BATCH_SIZE) {
    throw new Error(`Benchmark batch size must be an integer from 1 to ${MAX_BENCHMARK_BATCH_SIZE}`);
  }
  return Array.from(
    { length: Math.ceil(TOTAL_BENCHMARK_CASES / batchSize) },
    (_, index) => ({
      start: index * batchSize,
      limit: Math.min(batchSize, TOTAL_BENCHMARK_CASES - index * batchSize),
    }),
  );
}
