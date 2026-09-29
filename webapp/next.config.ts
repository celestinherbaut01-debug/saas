import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // The app and Edge Function share the same pure scoring rules.
  turbopack: { root: path.join(__dirname, "..") },
  outputFileTracingRoot: path.join(__dirname, ".."),
};

export default nextConfig;
