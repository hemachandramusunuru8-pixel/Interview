import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Every page depends on the signed-in user, so pages are rendered per request.
  cacheComponents: false,
  // Resume uploads go through Server Actions: 5 MB file plus multipart overhead.
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
