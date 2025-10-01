import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },
  webpack: (config, { isServer }) => {
    // Externalize native modules for server-side only
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({
        '@resvg/resvg-js': 'commonjs @resvg/resvg-js'
      });
    }
    return config;
  },
};

export default nextConfig;
