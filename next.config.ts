import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: false,
  },
  reactCompiler: false,
};

export default withSentryConfig(nextConfig, {
  // Suppress source map upload warnings when no auth token is set
  silent: !process.env.SENTRY_AUTH_TOKEN,

  // Upload source maps for better stack traces (requires SENTRY_AUTH_TOKEN)
  widenClientFileUpload: true,

  // Disable Sentry telemetry
  disableLogger: true,
});
