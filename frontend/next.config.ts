import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Genera .next/standalone: server.js minimo + solo las dependencias usadas.
  // Es lo que copia la etapa "runner" del Dockerfile.
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
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
