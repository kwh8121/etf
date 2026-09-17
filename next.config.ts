import { dirname } from "path";
import { fileURLToPath } from "url";
import type { NextConfig } from "next";

const root = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  cacheComponents: true,
  turbopack: {
    root,
  },
};

export default nextConfig;
