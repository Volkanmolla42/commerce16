import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.104", "192.168.1.*"],
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.convex.cloud",
      },
      {
        protocol: "https",
        hostname: "*.convex.site",
      },
    ],
  },
  async redirects() {
    return [
      {
        source: "/account",
        destination: "/account/orders",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
