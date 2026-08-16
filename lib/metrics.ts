export function average(values: readonly number[]): number | null {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

export function p95(values: readonly number[]): number | null {
  const sorted = values.filter(Number.isFinite).filter(value => value > 0).sort((a, b) => a - b);
  if (!sorted.length) return null;
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)];
}

export function rate(matched: number, total: number): number | null {
  return total > 0 ? matched / total : null;
}
