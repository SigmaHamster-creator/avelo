# Avelo

**Every journey, thoughtfully arranged.**

Scheduled rides for your loved ones, matched to their needs.

Avelo is a hackathon MVP (Hackachusetts, powered by Kiro — Healthcare & Biotech track) that lets a caregiver in
rural Massachusetts describe a non-emergency medical transportation trip once — by form or by English voice — and
immediately receive a round-trip price estimate. Avelo then simulates matching the trip with a suitable fictional
provider: it confirms automatically when the price holds, and asks for the caregiver's approval when the price
changes.

This is a **customer-facing-only** MVP. There is no dispatcher dashboard, driver app, or provider portal. Avelo
performs no clinical triage and no emergency dispatch — it is for scheduled, non-emergency transportation only.

## Table of contents

- [Setup and running locally](#setup-and-running-locally)
- [Testing](#testing)
- [Real vs. simulated functionality](#real-vs-simulated-functionality)
- [Enabling a real voice/AI extraction provider](#enabling-a-real-voiceai-extraction-provider)
- [Architecture](#architecture)
- [Persistence and limitations](#persistence-and-limitations)
- [Deployment](#deployment)
- [Kiro usage](#kiro-usage)
- [Submission checklist](#submission-checklist)

## Setup and running locally

Requirements: Node.js 20.9+ (required by Next.js 16), npm.

```powershell
cd avelo
npm install
npm run dev
```

Open http://localhost:3000 in Chrome or Edge (they support voice input; other browsers show the text box, which uses the same pipeline). No environment variables, API keys, or external services are required to run the full
demo end to end — voice extraction uses a deterministic, clearly-labeled fallback by default (see below).

Other scripts:

```powershell
npm run build   # production build (also type-checks)
npm start       # run the production build
npm run lint    # eslint
```

## Testing

Unit and property-based tests (Vitest + fast-check), covering the field-merge contract, validation, pricing, the
suggested-pickup-time formula, and the booking state machine:

```powershell
npm run test
```

As of the last run in this environment: **68/68 tests passed** (9 test files: FormValidator, FieldMergeEngine,
PricingEngine, PickupTimeCalculator, BookingStateMachine, MatchingSimulator, the voice extractor, the booking-draft
reducer, and hospital-address autofill).

End-to-end journey tests (Playwright). `npm run test:e2e` builds the app first and runs the tests against the
production server on port 3100, so it never conflicts with `npm run dev`:

```powershell
npx playwright install chromium   # first time only
npm run test:e2e
```

These tests drive the real UI and API routes through the form and the typed-text input (voice capture itself uses the browser's `SpeechRecognition` API, which cannot be driven headlessly in CI/Playwright
in a hardware-independent way — see [Real vs. simulated functionality](#real-vs-simulated-functionality)). Voice
extraction merge behavior is instead covered directly by the Vitest suite against the same extraction module the
API route calls.

As of the last run in this environment: **6/6 e2e tests passed** (Standard Arrangement; Special Request/Price
Revision via both the accept-new-price and find-another branches; Replacement; voice/text update with hospital
address autofill; and repeat-after-reset).

## Real vs. simulated functionality

| Area | Status | Notes |
|---|---|---|
| Manual form entry, validation | **Real** | `FormValidator` (`src/domain/formValidator.ts`), shared by manual and voice-populated updates. |
| Microphone capture & transcription | **Real** | Uses the browser's native `SpeechRecognition` (Web Speech API) in continuous mode, so pauses don't end the recording. Recording ends when you click **Stop**, after 4 seconds of silence once you've spoken, or after 60 seconds. Chrome and Edge send audio to their own speech service; there is no Avelo server transcription call. |
| Voice field extraction (English transcript -> form patch) | **Real code, deterministic-fallback data** | `DeterministicFallbackExtractor` (`src/domain/voiceExtractionAdapter.ts`) is a small, documented, auditable set of regex/keyword rules. It is **not** an AI model and is tagged `source: "deterministic-fallback"` everywhere it appears, never represented as a real model call. A real LLM-backed adapter is **pluggable** (see below) but not implemented/enabled in this submission. |
| Field merge (latest-wins, stale-rejection, undo) | **Real** | `FieldMergeEngine` (`src/domain/fieldMergeEngine.ts`), covered by property-based tests. |
| Hospital address autofill | **Real code, fictional data** | `src/domain/hospitalDirectory.ts`: naming a listed demo hospital (by voice or typing) fills its address unless you entered one yourself. The addresses are fictional and never shown as verified. |
| Price estimation | **Real calculation, fixture-driven data** | `PricingEngine` + a documented route-distance/fare fixture table (`src/domain/routeFixtures.ts`). Not a live pricing API. |
| Suggested pickup time | **Real calculation, fixture-driven data** | `PickupTimeCalculator` — never described as based on live traffic. |
| Provider matching & acceptance | **Simulated** | `MatchingSimulator` + `DemoScenarioRunner`-equivalent (`src/server/matchingScheduler.ts`) drive deterministic, fixed-delay outcomes from fictional provider/scenario fixtures (`src/domain/demoScenarios.ts`). No real transportation network exists. |
| Booking state machine | **Real** | `BookingStateMachine` (`src/domain/bookingStateMachine.ts`) is the sole mutator of booking status; a candidate match alone is never "Confirmed." |
| Persistence | **Simplified, non-production** | See [Persistence and limitations](#persistence-and-limitations). |
| Login / payment | **Not implemented, by design** | No login or real payment is required or collected anywhere in this MVP. |

## Enabling a real voice/AI extraction provider

Avelo's voice pipeline is built around a small adapter interface:

```typescript
interface VoiceExtractionAdapter {
  extract(input: { transcript: string; currentFormSnapshot: BookingFormData; nowISO: string }): Promise<VoiceExtractResult>;
}
```

To enable a real LLM-backed extractor:

1. Implement `VoiceExtractionAdapter` in a new server-only module (e.g. `src/domain/openAiExtractor.ts`), calling your
   chosen provider and returning a `FormFieldPatch` that satisfies the same merge contract.
2. Select it in `getActiveExtractor()` (`src/domain/voiceExtractionAdapter.ts`) based on `process.env.AI_EXTRACTION_PROVIDER`.
3. Set `AI_EXTRACTION_PROVIDER` and your provider's API key (e.g. `AI_EXTRACTION_API_KEY`) as environment variables on
   the server only (see `.env.example`). They are read inside `src/app/api/voice/extract/route.ts`, a server-only
   Next.js API route, and are never sent to the browser or committed to source control.
4. The server route (`POST /api/voice/extract`) already validates every extractor's output against the
   `FormFieldPatch` shape before it ever reaches `FieldMergeEngine` — a malformed or malicious real-provider response
   cannot mutate arbitrary application state.

No real provider is wired in for this submission; the app is fully runnable and demonstrable without one.

## Architecture

Single Next.js (App Router) + TypeScript application, no separate backend service, no production database.

- **UI (`src/app`)**: Landing, Booking Form, Estimate & Review, Booking Status, Arrangement Details screens, plus a
  discreet Demo Controls drawer available from every screen.
- **Shared domain logic (`src/domain`)**: `BookingFormData`/`FormFieldPatch` types, `FormValidator`,
  `FieldMergeEngine`, `PricingEngine`, `PickupTimeCalculator`, `BookingStateMachine`, `MatchingSimulator`,
  `VoiceExtractionAdapter`, and the demo scenario fixtures. These are plain, isomorphic TypeScript with no
  server-only dependencies, so the exact same modules run both in the browser (for instant manual/voice feedback)
  and inside the API routes (for server-side re-validation before anything is persisted).
- **Server-only (`src/server`)**: `BookingStore` (in-memory booking/timer storage) and `matchingScheduler`
  (deterministic, fixed-delay scenario progression).
- **API routes (`src/app/api/**`)**: `/api/estimate`, `/api/voice/extract`, `/api/booking/request`,
  `/api/booking/[id]`, `/api/booking/[id]/accept-price`, `/api/booking/[id]/find-another`,
  `/api/booking/[id]/replace`, `/api/demo/load-scenario`, `/api/demo/reset`.

### A documented deviation from the original design sketch

The pre-submission **form draft** lives in browser-side React state (`src/components/booking/BookingProvider.tsx`)
rather than in a server-side session store. Because `FormValidator` and `FieldMergeEngine` are plain, dependency-free
TypeScript, they run identically whether invoked from the client (for instant feedback) or from a server API route
(for re-validation before persisting) — only the *storage location* of the pre-submission draft changed from the
original per-session server store sketched during design, not any of the documented merge/validation/versioning
rules themselves. This is recorded in the "Implementation Status" section of `.kiro/specs/avelo/tasks.md` and in
`src/server/bookingStore.ts`'s header comment.

## Persistence and limitations

`BookingStore` is a single-process, in-memory store (optionally surviving Next.js dev-server hot reloads via
`globalThis`, but **not** durable across a real restart, and **not** authenticated or multi-user safe). This is
explicitly a hackathon-appropriate simplification, not a production data store — there is no real customer data
in it, only fictional demo bookings. Restarting the server clears all in-progress bookings.

## Deployment

Deploy to a host that runs one long-running Node process (Render, Railway, Fly.io, or a VM). The repository root
includes `render.yaml` for a Render Blueprint. **Serverless hosts such as Vercel are not supported**: demo bookings
live in memory and advance with server-side timers, which serverless functions don't keep. Manually:

```powershell
npm run build
npm start   # serves on $PORT, defaults to 3000
```

Set `AI_EXTRACTION_PROVIDER`/`AI_EXTRACTION_API_KEY` only if enabling a real voice provider (optional, see above).
No other environment variables are required. Because `BookingStore` is in-memory, a serverless/multi-instance host
would need a shared store (e.g. Redis) before this would work correctly across multiple instances — out of scope
for this MVP, and noted here for completeness.

## Kiro usage

See `.kiro/specs/avelo/` for the full requirements, design, and task-plan specs that drove this implementation, and
[`KIRO_USAGE.md`](../KIRO_USAGE.md) for an account of how Kiro's spec workflow, steering files, and hook were used.

## Submission checklist

See [`SUBMISSION_CHECKLIST.md`](../SUBMISSION_CHECKLIST.md).
