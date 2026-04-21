import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@prisma/client", "prisma", "pg", "ioredis", "pdfkit"],
  outputFileTracingExcludes: {
    "*": ["node_modules/@prisma/engines/**"],
  },
};

export default nextConfig;
