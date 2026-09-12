# Evidence Router — Systems Engineering & Architecture Design

## 1. System Philosophy & Executive Summary

Evidence Router is an autonomous inference-routing engine designed to solve the **inference-waste problem** in multi-agent and production AI architectures. 

Standard production systems suffer from two structural failure modes:
1. **Margin Bleed:** Over-routing low-complexity tasks to frontier models (e.g. GPT-4o, Claude 3.5 Sonnet) at high unit cost.
2. **Silent Quality Degradation:** Blindly falling back to open-source or tier-2 endpoints based on static marketing benchmarks ("vibes") without empirical verification against domain-specific task rubrics.

Evidence Router implements **dynamic, multi-variable constrained optimization** coupled with Bayesian evidence updating to route requests to the Pareto-optimal inference provider on a per-task basis.

```
┌─────────────────────────────────────────────────────────────┐
│                       USER REQUEST                          │
└──────────────────────────────┬──────────────────────────────┘
                               │
               ┌───────────────┴───────────────┐
               ▼                               ▼
    [Parallel Probe Probe]           [Historical Evidence]
    • Gemini 3.1 Flash-Lite          • Prior Quality Distributions
    • Llama 3.3 70B (NVIDIA)         • P95/P99 Latency Profiles
    • DeepSeek V3 (OpenRouter)       • Token Cost Schedules
    • GPT-OSS 120B (HuggingFace)     • Circuit-Breaker State
               │                               │
               └───────────────┬───────────────┘
                               ▼
            ┌─────────────────────────────────────┐
            │       UTILITY SCORING ENGINE        │
            │  (0.40Q + 0.25L + 0.20C + 0.15R)    │
            └──────────────────┬──────────────────┘
                               ▼
            ┌─────────────────────────────────────┐
            │        SUFFICIENCY PROOF            │
            │  • Constraint Satisfiability        │
            │  • Deterministic Rubric Pass        │
            │  • Rejection Matrix Construction    │
            └──────────────────┬──────────────────┘
                               ▼
                     [VERIFIED OUTPUT]
```

---

## 2. Core Utility Scoring Algorithm

The routing engine solves the following optimization problem for each candidate model $m \in M$ under a constraint set $C = \{Q_{floor}, L_{max}, C_{max}, R_{floor}\}$:

$$\text{Score}(m, C) = 0.40 \cdot H_Q(m) + 0.25 \cdot H_L(m) + 0.20 \cdot E_C(m) + 0.15 \cdot R(m)$$

Where:
*   **Quality Headroom ($H_Q$):** Normalized accuracy relative to the quality floor:
    $$H_Q(m) = \max(0, Q(m) - Q_{floor}) + Q_{floor}$$
*   **Latency Headroom ($H_L$):** Distance from the SLA deadline, clamped to $[0, 1]$:
    $$H_L(m) = \max\left(0, 1 - \frac{L(m)}{\max(L_{max}, 1)}\right)$$
*   **Cost Efficiency ($E_C$):** Margin savings relative to the maximum allowable budget:
    $$E_C(m) = \max\left(0, 1 - \frac{\text{Cost}(m)}{\max(C_{max}, 10^{-9})}\right)$$
*   **Reliability Prior ($R$):** Exponentially decaying uptime and success rate:
    $$R(m) \in [0, 1]$$

### Bayesian Evidence Blending

When historical trace evidence $E$ for a specific task category contains $N \ge 3$ verified runs, the base utility score is updated using an empirical posterior:

$$\text{Score}_{\text{final}} = 0.70 \cdot \text{Score}_{\text{base}} + 0.30 \cdot \text{Score}_{\text{evidence}}$$

Where $\text{Score}_{\text{evidence}}$ computes the running empirical mean of historical quality, latency, and SLA compliance.

---

## 3. The 3-Strike Circuit Breaker Architecture

To protect agentic pipelines from cascading timeouts during provider outages:
1. Every provider maintains a sliding-window failure counter.
2. Upon **3 consecutive transport failures, HTTP 5xx responses, or SLA timeouts (>3500ms)**, the circuit trips to `OPEN`.
3. Requests bypass the tripped provider entirely for a 30-second cooldown window.
4. After cooldown, a single canary probe is dispatched. If successful, the circuit resets to `CLOSED`.

---

## 4. Replay Engine & Offline Verification

Evidence Router includes a deterministic offline replay engine (`backend/app/router.py:replay_route`). 

This allows engineering teams to simulate what their inference bills and quality distributions would have looked like across 10,000 historical tasks if they had used Evidence Router instead of a static model configuration.

---

## 5. Drop-in Production Integration

The engine implements the OpenAI-compatible `/v1/chat/completions` protocol. Upstream applications integrate with a single line-of-code configuration:

```typescript
import { OpenAI } from "openai";

const client = new OpenAI({
  baseURL: "https://api.evidence-router.io/v1",
  apiKey: process.env.EVIDENCE_ROUTER_KEY,
});

// All calls automatically evaluated, routed, and recorded to Postgres trace ledger
const response = await client.chat.completions.create({
  model: "auto:evidence-rank",
  messages: [{ role: "user", content: "Extract financial metrics..." }],
});
```
