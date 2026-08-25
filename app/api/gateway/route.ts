import { NextResponse } from "next/server";
import { getOpenRouterApiKey } from "@/lib/config";
import { isLongHorizonTask, runOxAlpha } from "@/lib/ox-alpha";
import { runProviderCascade } from "@/lib/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Bucket = { windowStarted: number; count: number };
const buckets = new Map<string, Bucket>();
const WINDOW_MS = 60_000;
const DEFAULT_LIMIT = 60;
const MAX_TASK_LENGTH = 50_000;

function clientId(req: Request): string {
  return req.headers.get("x-api-client") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
}

function gatewayLimit(): number {
  const value = Number(process.env.GATEWAY_RATE_LIMIT_PER_MINUTE ?? DEFAULT_LIMIT);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : DEFAULT_LIMIT;
}

function consumeRateLimit(id: string): { allowed: boolean; remaining: number; resetSeconds: number } {
  const now = Date.now();
  const existing = buckets.get(id);
  if (!existing || now - existing.windowStarted >= WINDOW_MS) {
    buckets.set(id, { windowStarted: now, count: 1 });
    return { allowed: true, remaining: gatewayLimit() - 1, resetSeconds: 60 };
  }

  existing.count += 1;
  const remaining = Math.max(0, gatewayLimit() - existing.count);
  const resetSeconds = Math.max(1, Math.ceil((WINDOW_MS - (now - existing.windowStarted)) / 1000));
  return { allowed: existing.count <= gatewayLimit(), remaining, resetSeconds };
}

function buildHeaders(requestId: string, rate: { remaining: number; resetSeconds: number }) {
  return {
    "x-request-id": requestId,
    "x-ratelimit-limit": String(gatewayLimit()),
    "x-ratelimit-remaining": String(rate.remaining),
    "x-ratelimit-reset": String(rate.resetSeconds),
    "cache-control": "no-store",
  };
}

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  const rate = consumeRateLimit(clientId(req));
  const headers = buildHeaders(requestId, rate);

  if (!rate.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded", requestId }, { status: 429, headers });
  }

  const expectedKey = process.env.GATEWAY_API_KEY;
  if (expectedKey && req.headers.get("x-api-key") !== expectedKey) {
    return NextResponse.json({ error: "Unauthorized", requestId }, { status: 401, headers });
  }

  try {
    const body = await req.json().catch(() => null);
    const task = typeof body?.task === "string" ? body.task.trim().slice(0, MAX_TASK_LENGTH) : "";
    if (!task) return NextResponse.json({ error: "task is required", requestId }, { status: 400, headers });

    const messages = [
      { role: "system" as const, content: "You are a production AI assistant. Answer directly, accurately, and concisely." },
      { role: "user" as const, content: task },
    ];

    const longHorizon = isLongHorizonTask(task);
    let result: { provider: string; model: string; output: string; latencyMs: number; inputTokens: number; outputTokens: number; reasoningTokens: number; totalTokens: number; fallbackCount: number } | null = null;

    if (longHorizon && getOpenRouterApiKey()) {
      try {
        const ox = await runOxAlpha(messages, 1200, 8_000);
        result = {
          provider: "openrouter",
          model: ox.model,
          output: ox.output,
          latencyMs: ox.latencyMs,
          inputTokens: ox.inputTokens,
          outputTokens: ox.outputTokens,
          reasoningTokens: ox.reasoningTokens,
          totalTokens: ox.totalTokens,
          fallbackCount: 0,
        };
      } catch (error) {
        console.warn("Ox Alpha escalation failed; using standard cascade", { requestId, error: error instanceof Error ? error.message : "unknown" });
      }
    }

    if (!result) {
      const cascade = await runProviderCascade(messages, longHorizon ? 1200 : 400, {
        costFirst: true,
        maxModelsPerProvider: 2,
        attemptTimeoutMs: longHorizon ? 4_000 : 2_500,
        totalDeadlineMs: 12_000,
      });
      if (!cascade.result) {
        return NextResponse.json({ error: "No healthy model could serve this request", requestId, attempts: cascade.attempts }, { status: 503, headers });
      }
      result = {
        provider: cascade.result.provider,
        model: cascade.result.model,
        output: cascade.result.output,
        latencyMs: cascade.result.latencyMs,
        inputTokens: cascade.result.inputTokens,
        outputTokens: cascade.result.outputTokens,
        reasoningTokens: cascade.result.reasoningTokens,
        totalTokens: cascade.result.totalTokens,
        fallbackCount: Math.max(0, cascade.attempts.length - 1),
      };
    }

    return NextResponse.json({
      requestId,
      policy: longHorizon ? "ox-alpha-escalation" : "cost-first-cascade",
      provider: result.provider,
      model: result.model,
      output: result.output,
      metrics: {
        latencyMs: result.latencyMs,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        reasoningTokens: result.reasoningTokens,
        totalTokens: result.totalTokens,
        fallbackCount: result.fallbackCount,
      },
    }, { headers });
  } catch (error) {
    console.error("Gateway request failed", { requestId, error });
    return NextResponse.json({ error: "Gateway could not process the request", requestId }, { status: 503, headers });
  }
}
