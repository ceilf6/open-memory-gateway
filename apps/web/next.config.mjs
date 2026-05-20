import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.dirname(fileURLToPath(import.meta.url));

/** @type {import("next").NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.join(appDir, "../.."),
  serverExternalPackages: ["better-sqlite3"],
  webpack(config, { isServer }) {
    if (isServer) {
      config.externals.push({ "better-sqlite3": "commonjs better-sqlite3" });
    }
    return config;
  },
};

export default nextConfig;
