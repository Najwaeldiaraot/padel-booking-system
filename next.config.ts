import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "react-router": path.resolve(__dirname, "src/lib/router-compat.tsx"),
    };
    return config;
  },
  turbopack: {
    resolveAlias: {
      "react-router": "./src/lib/router-compat.tsx",
    },
  },
};

export default nextConfig;
