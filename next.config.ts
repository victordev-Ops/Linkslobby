// next.config.ts
import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

const withSerwist = withSerwistInit({
  swSrc: "src/sw.ts",        // Your service worker source
  swDest: "public/sw.js",    // Compiled service worker output
  disable: process.env.NODE_ENV === "development",
});

/** @type {NextConfig} */
const nextConfig: NextConfig = {
  // ✅ Put your existing Next.js config here
  reactStrictMode: true,
};

export default withSerwist(nextConfig);
