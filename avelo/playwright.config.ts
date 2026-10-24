import { defineConfig } from "@playwright/test";

/**
 * End-to-end journey tests (Tasks 3.14, 5.8, 6.6, 7.8). These drive the
 * real Next.js dev server with real HTTP requests to the real API
 * routes; only the simulated matching/pricing/voice-fallback DOMAIN
 * behavior is fixture-driven, exactly as documented in the README.
 *
 * Voice capture itself (the browser SpeechRecognition API) cannot be
 * driven headlessly in a reliable, hardware-independent way, so these
 * e2e tests exercise the manual form path and the typed-natural-language
 * fallback input, which share the exact same validation and extraction
 * pipeline as spoken voice input. Voice-specific merge/extraction
 * behavior is covered by the Vitest unit/property tests instead (see
 * src/domain/__tests__/voiceExtractionAdapter.test.ts).
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3100",
  },
  // Runs against the production build (see the "test:e2e" script, which
  // builds first), so it never conflicts with a running `next dev` server.
  webServer: {
    command: "npx next start --port 3100",
    url: "http://localhost:3100",
    reuseExistingServer: true,
    timeout: 60000,
  },
});
