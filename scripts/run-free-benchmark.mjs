/**
 * scripts/run-free-benchmark.mjs
 *
 * Generates 100 real evidence rows against free-tier providers only.
 * Cost: $0 | Time: ~45 min | Rate: 1 req/sec to stay under limits
 *
 * Usage: node scripts/run-free-benchmark.mjs
 *
 * Providers used (all free tiers):
 *   - gemini:  ai.google.dev (15 req/min free)
 *   - huggingface: hf.co/inference-endpoints (free small models)
 *   - openrouter: openrouter.ai (1 free model)
 *
 * No NVIDIA (paid only). No OpenAI (paid only).
 */

const BASE_URL = process.env.BENCHMARK_URL || "http://localhost:3000";
const TOTAL_CASES = 100;
const RATE_LIMIT_DELAY_MS = 1000; // 1 req/sec stays under all free tiers

const FREE_PROVIDERS = ["gemini", "huggingface", "openrouter"];

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runCase(provider, caseIndex) {
  const start = Date.now();
  try {
    const res = await fetch(`${BASE_URL}/api/benchmark?start=${caseIndex}&limit=1`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        task: `benchmark-case-${caseIndex}`,
        task_type: ["reasoning", "coding", "extraction", "creative", "classification", "math", "qa", "summarization"][caseIndex % 8],
        providers: [provider],
        constraints: {
          quality_floor: 0.7,
          max_latency_ms: 5000,
          max_cost_usd: 0.01,
        },
      }),
      signal: AbortSignal.timeout(30_000),
    });
    const latency = Date.now() - start;
    if (res.ok) {
      const data = await res.json();
      const result = data.results?.[0] ?? {};
      return {
        provider,
        caseIndex,
        status: result.status ?? "unknown",
        quality: result.quality ?? 0,
        latencyMs: result.latencyMs ?? latency,
        costUsd: result.costUsd ?? 0,
        model: result.model ?? provider,
        success: true,
      };
    }
    return { provider, caseIndex, status: `http_${res.status}`, success: false };
  } catch (err) {
    return { provider, caseIndex, status: `error_${err.message}`, success: false };
  }
}

async function runFreeBenchmark() {
  console.log(`[free-benchmark] Starting against ${BASE_URL}`);
  console.log(`[free-benchmark] Target: ${TOTAL_CASES} real evidence rows`);
  console.log(`[free-benchmark] Providers: ${FREE_PROVIDERS.join(", ")}`);
  console.log(`[free-benchmark] Rate limit: ${RATE_LIMIT_DELAY_MS}ms between calls`);
  console.log("[free-benchmark] This will take ~45 minutes at 1 req/sec");
  console.log("");

  let completed = 0;
  let passed = 0;
  let failed = 0;
  const results = [];

  for (let i = 0; i < TOTAL_CASES; i++) {
    const provider = FREE_PROVIDERS[i % FREE_PROVIDERS.length];
    process.stdout.write(`[${i + 1}/${TOTAL_CASES}] ${provider} case ${i}... `);

    const result = await runCase(provider, i);
    results.push(result);
    completed++;

    if (result.success) {
      passed++;
      console.log(`✅ quality=${result.quality} latency=${result.latencyMs}ms cost=$${result.costUsd.toFixed(6)}`);
    } else {
      failed++;
      console.log(`❌ ${result.status}`);
    }

    // Persist each row to /api/persistence immediately (so partial run = partial data)
    if (result.success) {
      try {
        await fetch(`${BASE_URL}/api/persistence`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            externalId: `free-${provider}-${i}`,
            task: `benchmark-case-${i}`,
            status: result.status,
            selectedModel: result.model,
            provider: result.provider,
            quality: result.quality,
            latencyMs: result.latencyMs,
            costUsd: result.costUsd,
            category: ["reasoning", "coding", "extraction", "creative", "classification", "math", "qa", "summarization"][i % 8],
            strategy: "adaptive",
            traceJson: { source: "free-benchmark", caseIndex: i },
          }),
        });
      } catch {
        // non-fatal: row still in memory
      }
    }

    // Rate limit throttle
    if (i < TOTAL_CASES - 1) {
      await sleep(RATE_LIMIT_DELAY_MS);
    }
  }

  console.log("");
  console.log("=== FREE BENCHMARK COMPLETE ===");
  console.log(`Total:   ${completed}`);
  console.log(`Passed:  ${passed}`);
  console.log(`Failed:  ${failed}`);
  console.log(`Success: ${completed > 0 ? Math.round((passed / completed) * 100) : 0}%`);

  // Compute EvidenceRank from results
  const modelScores = {};
  for (const r of results) {
    if (!r.success) continue;
    if (!modelScores[r.model]) modelScores[r.model] = { runs: 0, totalQuality: 0, totalLatency: 0, totalCost: 0 };
    const m = modelScores[r.model];
    m.runs++;
    m.totalQuality += r.quality;
    m.totalLatency += r.latencyMs;
    m.totalCost += r.costUsd;
  }

  console.log("");
  console.log("=== EVIDENCERANK (PageRank for AI) ===");
  const ranked = Object.entries(modelScores)
    .map(([model, s]) => ({
      model,
      evidenceRank: Math.round((s.totalQuality / s.runs) * s.runs * 1000) / 1000,
      avgQuality: Math.round((s.totalQuality / s.runs) * 1000) / 1000,
      avgLatencyMs: Math.round(s.totalLatency / s.runs),
      avgCost: Number((s.totalCost / s.runs).toFixed(6)),
      runs: s.runs,
    }))
    .sort((a, b) => b.evidenceRank - a.evidenceRank);

  for (const r of ranked) {
    console.log(`  ${r.model}: EvidenceRank=${r.evidenceRank} quality=${r.avgQuality} latency=${r.avgLatencyMs}ms cost=$${r.avgCost}/call runs=${r.runs}`);
  }

  return { completed, passed, failed, ranked };
}

runFreeBenchmark().catch((err) => {
  console.error("[free-benchmark] Fatal:", err);
  process.exit(1);
});
