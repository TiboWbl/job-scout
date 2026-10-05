import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev-mode indicator badge sits bottom-left and intercepts clicks on anything
  // underneath it — including our sidebar's own bottom-corner controls.
  devIndicators: false,
};

export default nextConfig;
