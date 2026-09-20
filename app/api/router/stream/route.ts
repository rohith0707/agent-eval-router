import { configuredProviders, modelRegistry, ProviderName, runProviderCascade } from "@/lib/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 45;

const providerLabels: Record<ProviderName, string> = {
  gemini: "Gemini",
  huggingface: "Hugging Face",
  nvidia: "NVIDIA",
  openrouter: "OpenRouter",
};

function scoreResult(quality: number, latencyMs: number, costUsd: number) {
  const latencyScore = Math.max(0, 1 - latencyMs / 8000);
  const costScore = Math.max(0, 1 - costUsd / 0.05);
  return Number((quality * 0.55 + latencyScore * 0.25 + costScore * 0.2).toFixed(4));
}

function line(payload: unknown) {
  return JSON.stringify(payload) + "\n";
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const task = typeof body.task === "string" && body.task.trim()
    ? body.task.trim()
    : "Fix the failing CI import and verify the result.";
  const maxTokens = Math.min(Number(body.max_tokens) || 256, 512);
  const maxCostUsd = Math.max(0.001, Number(body.max_cost_usd) || 0.05);

  const configured = configuredProviders();
  const registry = modelRegistry();
  const providers = (Object.keys(providerLabels) as ProviderName[]).filter((provider) => configured[provider]);
  const expectedProviders = Object.keys(providerLabels).length;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (payload: unknown) => controller.enqueue(encoder.encode(line(payload)));
      const parallelStartedAt = Date.now();
      let active = 0;
      let maxConcurrent = 0;

      send({
        type: "start",
        task,
        parallel: true,
        expectedProviders,
        configuredProviders: providers.length,
        providers: (Object.keys(providerLabels) as ProviderName[]).map((provider) => ({
          provider,
          label: providerLabels[provider],
          model: registry[provider]?.[0] ?? "no model configured",
          status: configured[provider] ? "running" : "not_configured",
          configured: configured[provider],
          startedAt: configured[provider] ? parallelStartedAt : undefined,
        })),
      });

      if (!providers.length) {
        send({ type: "error", message: "No live provider credentials are configured." });
        controller.close();
        return;
      }

      const results = await Promise.all(
        providers.map(async (provider) => {
          const model = registry[provider]?.[0];
          if (!model) return null;

          const startedAt = Date.now();
          const started = performance.now();
          active += 1;
          maxConcurrent = Math.max(maxConcurrent, active);

          try {
            const cascade = await runProviderCascade(
              [
                {
                  role: "system",
                  content:
                    "Solve the user's engineering task concisely. State the concrete result and any verification you can support. Do not claim tests ran unless they actually ran.",
                },
                { role: "user", content: task },
              ],
              maxTokens,
              {
                restrictToProviders: [provider],
                maxModelsPerProvider: 2,
                attemptTimeoutMs: 4000,
                totalDeadlineMs: 9000,
              },
            );

            if (!cascade.result) {
              const details = cascade.attempts
                .map((attempt) => `${attempt.model}: ${attempt.outcome}${attempt.statusCode ? ` (HTTP ${attempt.statusCode})` : ""}${attempt.detail ? ` — ${attempt.detail}` : ""}`)
                .join(" | ");
              throw new Error(details || `${provider} returned no eligible result`);
            }

            const result = cascade.result;
            const quality = Math.max(
              0.05,
              Math.min(
                1,
                0.55 +
                  (result.output.length > 120 ? 0.2 : 0) +
                  (result.output.includes(task.split(" ").slice(0, 3).join(" ")) ? 0.15 : 0),
              ),
            );
            const latencyMs = Math.max(result.latencyMs, Math.round(performance.now() - started));
            const score = scoreResult(quality, latencyMs, result.estimatedCostUsd);
            const item = {
              provider,
              label: providerLabels[provider],
              model: result.model,
              status: "complete",
              outcome: "success",
              quality: Number(quality.toFixed(3)),
              latencyMs,
              costUsd: result.estimatedCostUsd,
              score,
              preview: result.output.slice(0, 280),
              output: result.output,
              attempts: cascade.attempts,
              startedAt,
              completedAt: Date.now(),
            };
            send({ type: "result", ...item });
            return item;
          } catch (error) {
            const statusCode = typeof error === "object" && error && "statusCode" in error
              ? Number((error as { statusCode?: unknown }).statusCode) || undefined
              : undefined;
            const detail = typeof error === "object" && error && "detail" in error
              ? String((error as { detail?: unknown }).detail ?? "")
              : "";
            const message = error instanceof Error ? error.message : "Provider failed";
            const item = {
              provider,
              label: providerLabels[provider],
              model,
              status: "failed",
              outcome: "error",
              latencyMs: Math.round(performance.now() - started),
              costUsd: 0,
              score: 0,
              preview: message.slice(0, 180),
              error: message.slice(0, 500),
              detail: detail.slice(0, 500),
              statusCode,
              startedAt,
              completedAt: Date.now(),
            };
            send({ type: "result", ...item });
            return item;
          } finally {
            active -= 1;
          }
        }),
      );

      const usable = results.filter(
        (item): item is NonNullable<typeof item> =>
          Boolean(item && item.status === "complete" && item.costUsd <= maxCostUsd),
      );
      const winner = usable.sort((a, b) => b.score - a.score)[0];
      const parallelFinishedAt = Date.now();

      send({
        type: "parallel_proof",
        expectedProviders,
        configuredProviders: providers.length,
        completedProviders: results.filter(Boolean).length,
        successfulProviders: results.filter((item) => item?.status === "complete").length,
        failedProviders: results.filter((item) => item?.status === "failed").length,
        maxConcurrent,
        wallClockMs: parallelFinishedAt - parallelStartedAt,
        proof:
          maxConcurrent > 1
            ? "Multiple provider calls overlapped in the same execution window."
            : "Only one provider call was active; configure more live providers to prove parallel execution.",
      });

      if (winner) {
        send({
          type: "selected",
          provider: winner.provider,
          label: winner.label,
          model: winner.model,
          score: winner.score,
          reason: "Selected from live parallel results using quality, latency and cost.",
        });
      } else {
        send({
          type: "selected",
          provider: null,
          label: "No verified route",
          model: null,
          score: 0,
          reason: "No provider produced an eligible result within the configured cost boundary.",
        });
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
