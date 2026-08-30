# 10× Product Launch Roadmap — Agent Eval Router
**Deadline: 20 Sep | CTO/Investor-ready AI Infrastructure Product**

---

## Phase 0 — P0 Must-Fix (Week 0, 2 hours)

| Task | Pattern | Skill |
|------|---------|-------|
| ✅ Seed demo data | `seed-demo-data.mjs` → 50 demo runs | `poyntall` |
| ✅ `/agent` page | `app/agent/page.tsx` — Trajectory Lab | `canveman` |
| ✅ `/evidence` page | Evidence Comparison UI | `poyntall` |
| ✅ Circuit breaker | `lib/circuit-breaker.ts` — skip 429/402 | `systematic-debugging` |
| ✅ Benchmark CI retry | `.github/workflows/benchmark-production.yml` — `set -euo pipefail` | `ponytail` |

---

## Phase 1 — P1 Product Polish (Week 1)

| Task | Pattern | Goal |
|------|---------|------|
| Provider Health UI (`/health`) | Real-time status badges | Show ✅/⚠️/❌ per provider |
| Benchmark Run History (`/benchmarks`) | Persist run metadata | List past runs with pass rate |
| Evidence Comparison Live | Fetch `/api/experiment` | Bar charts for quality/cost/latency |
| Failure Pattern Analyzer (`/failures`) | Categorize failures by HTTP code | RATE_LIMIT / AUTH / TIMEOUT patterns |
| Circuit Breaker UI | Visual per-provider state | CLOSED→HALF→OPEN display |

---

## Phase 2 — P2 Launch Prep (Week 2)

| Task | Pattern | Goal |
|------|---------|------|
| Agent Lab streaming | SSE for real-time trajectory | Live step-by-step output |
| Model Performance Charts | Quality/latency scatter plots | Recharts bar + line |
| Regression Alert System | Bell icon + delta badges | Alert if quality drops >5% |
| Audit Trail (`/traces`) | Git-like diff view | SHA per run, expand traces |
| One-Click Demo Mode | Seed + reset buttons | Settings page |

---

## Phase 3 — P3 Differentiation (Week 3-4)

| Task | Pattern | Goal |
|------|---------|------|
| Multi-Tenant Support | `X-Tenant-ID` header routing | Per-tenant model registry |
| LLM Routing SDK | `@agent-eval-router/sdk` npm | One-line integration |
| Routing Strategy Marketplace | Publish/import JSON strategies | Community strategies |
| Natural Language Policy Editor | NL → `ConstraintSet` JSON | Drag-drop policy builder |
| SOC2 Audit Mode | Immutable append-only log | RBAC + CSV export |

---

## Failure Pattern Library

| Failure | HTTP Code | Pattern | Auto-Fix |
|---------|-----------|---------|----------|
| Rate Limit | 429 | `CircuitBreaker` | Skip 60s, retry |
| Credit Exhausted | 402 | `ProviderDisable` | Alert + pause |
| Auth Expired | 401 | `TokenRefresh` | Re-auth flow |
| Timeout | — | `ExponentialBackoff` | Retry 3× |
| Empty Response | — | `FallbackCascade` | Next provider |
| Server Error | 500/502/503 | `RetryWithBackoff` | 3× backoff |

---

## 12-Week Sprint (20 Sep target)

```
Week 0:  P0 fixes + CI passes 50/50 ✅
Week 1:  P1 polish + health dashboard
Week 2:  P2 launch prep + regression alerts
Week 3:  P3 multi-tenant + SDK design
Week 4:  SDK publish + strategy marketplace
Week 5:  Natural language policy editor
Week 6:  SOC2 audit mode + RBAC
Week 7:  Performance regression CI
Week 8:  A/B testing harness
Week 9:  CTO demo + investor deck
Week 10: Beta launch
Week 11: Bug bash + security audit
Week 12: GA launch + job-ready portfolio piece
```

---

## Code Patterns (Apply to Every Feature)

### Feature Launch Pattern
```tsx
import { launchFeature } from '@/lib/featureLauncher';
import { poyntall } from '@/lib/poyntall';

export const launch = (name: string, Component: React.ComponentType) =>
  poyntall.ErrorBoundary({ fallback: <ErrorFallback name={name} /> })(
    launchFeature(name, Component)
  );
```

### Performance Pattern
```tsx
// ponytail: use lru_cache or SW caching — add when measured slow
const cached = await poyntall.cacheFirst('/api/data', fetchData);
```

### Analytics Pattern
```tsx
const { track } = poyntall.useAnalytics();
track('feature_view', { feature: name, timestamp: Date.now() });
```

---

## 10× Optimization Matrix

| Pillar | Action | Skill |
|--------|--------|-------|
| Performance | Code-split + lazy-load + CDN edge | `ponytail` |
| Conversion | Glass-button CTA + A/B test | `canveman` |
| Engagement | Canvas tour + gamified missions | `canveman` |
| Analytics | Amplitude + Segment plug-in | `poyntall` |
| Security | CSP + Sentry error boundary | `poyntall` |
| Deployment | GitOps + zero-downtime rollout | `poyntall` |
| Community | Referral engine + viral widgets | `poyntall` |
| UI/UX | Material-3 tokens + micro-animations | `canveman` |
| SEO | SSR + meta tags + prerender | `canveman` |
| Revenue | Tiered pricing + Stripe checkout | `poyntall` |
