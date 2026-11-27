import type { NextConfig } from "next";

// O backend não envia cabeçalhos de CORS (CORS_ORIGIN vazio). Em vez de mexer
// nele, o Next recebe as chamadas do navegador em /api/backend/* e repassa
// para o backend. O header Authorization segue junto, sem tocar no token.
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/backend/:path*",
        destination: `${BACKEND_URL}/:path*`,
      },
    ];
  },
  turbopack: {
    root: process.cwd(), // evita o Next procurar lockfile fora do projeto
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
