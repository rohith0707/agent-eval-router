/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingIncludes: {
    "/api/benchmark": ["./benchmarks/routing-bench-v1.jsonl"],
  },
};

export default nextConfig;
