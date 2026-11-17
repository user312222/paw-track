import type { NextConfig } from "next";

// Cache Components is switched off on purpose: every page here reads live
// salon data, so plain dynamic rendering is the simplest correct model.
const nextConfig: NextConfig = {};

export default nextConfig;
