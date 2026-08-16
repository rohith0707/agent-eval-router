export function getDatabaseUrl(): string | undefined {
  return (
    process.env.DATABASE_URL ??
    process.env.POSTGRES_PRISMA_URL ??
    process.env.POSTGRES_URL ??
    process.env.POSTGRES_URL_NON_POOLING
  );
}

export function getNvidiaApiKey(): string | undefined {
  return process.env.NVIDIA_API_KEY ?? process.env.NVIDIA_NIM_API_KEY;
}

export function getNvidiaModel(): string {
  return process.env.NVIDIA_MODEL ?? "meta/llama-3.3-70b-instruct";
}
