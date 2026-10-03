import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
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
