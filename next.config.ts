import type { NextConfig } from "next";

// When Vercel deploys, it sets VERCEL=1 and manages its own output pipeline.
// For self-hosted / sandbox builds we produce a standalone bundle so that
// `NODE_ENV=production node .next/standalone/server.js` works out of the box.
const isVercel = process.env.VERCEL === "1";

const nextConfig: NextConfig = {
  // Standalone mode is only used for self-hosted / sandbox deployments.
  // Vercel has its own build and deployment pipeline that does not require it.
  ...(isVercel ? {} : { output: "standalone" }),
  // Strict build: type errors must fail the build, never be masked.
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: true,
  // Ship the trained Sathi quantile boosters (ml-artifacts/) with the
  // standalone server so /api/v1 model forecasts work in production too.
  outputFileTracingIncludes: {
    "/api/v1/**": ["./ml-artifacts/**/*"],
  },
};

export default nextConfig;
