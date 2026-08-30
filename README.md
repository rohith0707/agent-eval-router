# Agent Eval Router — Evidence-Based LLM Routing

> We route LLM requests to the model that actual wins — proven by empirical evaluation, not marketing claims.

**Live URL:** https://agent-eval-router-balsarohith5-5561s-projects.vercel.app

## The "PageRank for AI" Concept

How do you know which LLM to use for a specific production task? 

You don't guess. You benchmark candidates across your data, assign an **EvidenceRank** (a weighted quality score across historical runs), and automatically route to the highest-scoring model that meets your cost and latency constraints.

### The Single Decision Console

This platform forces explicit explainability. When a model is chosen, we justify the decision:
- **Winner:** `gemini-3.5-flash-lite` (EvidenceRank: 47, Avg Quality: 0.94, Avg Latency: 380ms)
- **Rejected:** `gpt-4o` (37× cost delta for only +0.02 quality lift — explicitly rejected)
- **ROI:** Saved $4.20 per 1,000 queries compared to baseline.

## Technical Architecture

This is a production-hardened routing layer, not a thin wrapper.

- **Routing:** 4-provider cascade (Gemini, HuggingFace, OpenAI-OSS, OpenRouter).
- **Resilience:** Circuit-breaker implemented for rate limits (HTTP 429), quota exhaustion (HTTP 402), and timeouts (HTTP 503) to ensure automatic fallback.
- **Evaluation Engine:** Deterministic, stateful agent trajectory grading.
- **Persistence:** PostgreSQL with Prisma ORM backing the EvidenceRank aggregation.

### 5-Minute Verification

We don't fake metrics. To see the EvidenceRank engine compute real decisions against free-tier LLM endpoints:

```bash
# Seed the database with a 50-case benchmark evaluation
curl -X POST "https://agent-eval-router-balsarohith5-5561s-projects.vercel.app/api/benchmark?start=0&limit=50"
```

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Backend:** Python (FastAPI agent simulation) / Node.js
- **Database:** PostgreSQL (Neon) with Prisma ORM
- **Deployment:** Vercel (Edge caching + dynamic compute)
- **CI/CD:** Github Actions with deterministic pipeline contracts (`set -euo pipefail`)

---

*Designed and engineered by Rohith Balsa for high-reliability AI platforms.*
