import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev-mode indicator badge sits bottom-left and intercepts clicks on anything
  // underneath it — including our sidebar's own bottom-corner controls.
  devIndicators: false,
  experimental: {
    // A tab visited in the last 30 s opens at once; every change made in the app refreshes it.
    staleTimes: { dynamic: 30 },
  },
};

export default nextConfig;
