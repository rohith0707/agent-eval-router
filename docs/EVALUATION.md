# Evaluation Methodology

## Objective

Measure routing decisions across four production-relevant dimensions: quality, latency, cost, and reliability.

## v0.1

The current scorecard uses versioned fixture values so the product and routing workflow can be tested deterministically. These values are not presented as live provider measurements.

## Next benchmark

The next benchmark should contain at least 100 reproducible cases across reasoning, RAG, structured output, tool calling, and agent planning.

Each case should define task input, expected behavior, success criteria, category, and difficulty. Results should record model, evaluator scores, latency, token usage, cost, failure class, and trace ID.

## Success criteria

A routing strategy should be compared against single-model baselines. The primary question is whether adaptive routing improves the quality/cost/latency trade-off without increasing reliability failures.
