import { dirname } from "path";
import { fileURLToPath } from "url";
import type { NextConfig } from "next";

const root = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  cacheComponents: true,
  experimental: {
    // TypeScript 5.x supports the compiler API. This avoids the CLI's empty
    // piped --showConfig output in the current Node 22 build environment.
    useTypeScriptCli: false,
  },
  turbopack: {
    root,
  },
};

export default nextConfig;
