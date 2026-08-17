export function getDatabaseUrl(): string | undefined {
  return (
    process.env.DATABASE_URL ??
    process.env.POSTGRES_PRISMA_URL ??
    process.env.POSTGRES_URL ??
    process.env.POSTGRES_URL_NON_POOLING
  );
}

export function getGeminiApiKey(): string | undefined {
  return process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? process.env.Gemini_API;
}

export function getHuggingFaceToken(): string | undefined {
  return process.env.HF_TOKEN ?? process.env.HUGGINGFACE_API_KEY ?? process.env.Huggingface;
}

export function getNvidiaApiKey(): string | undefined {
  return process.env.NVIDIA_API_KEY ?? process.env.NVIDIA_NIM_API_KEY;
}

export function getOpenRouterApiKey(): string | undefined {
  return process.env.OPENROUTER_API_KEY;
}

export function getNvidiaModel(): string {
  return process.env.NVIDIA_MODEL ?? "meta/llama-3.3-70b-instruct";
}
