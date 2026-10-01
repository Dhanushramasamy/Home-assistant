import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The board code download reads the firmware template at runtime.
  outputFileTracingIncludes: {
    "/api/boards/\\[id\\]/code": ["./firmware/template/**/*"],
  },
};

export default nextConfig;
