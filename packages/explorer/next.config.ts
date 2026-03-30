import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the explorer to import from workspace packages
  transpilePackages: ["@agent-economy-wallet/core"],

  // Suppress Node.js module warnings from @solana/web3.js in server components
  serverExternalPackages: ["@solana/web3.js"],

  // Turbopack config (required by Next.js 16+)
  turbopack: {},

  // Webpack config to handle any edge cases with Node.js polyfills
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Don't bundle Node.js modules on the client side
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      };
    }
    return config;
  },
};

export default nextConfig;
