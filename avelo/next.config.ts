import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Avelo is a fully dynamic, client-driven app (every screen fetches its
   * own data from the API routes at runtime) -- static/partial
   * prerendering is not useful here, so both experimental features are
   * left off to avoid requiring Suspense boundaries around every
   * client-side hook. */
};

export default nextConfig;
