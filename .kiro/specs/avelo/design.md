# Design Document

## Overview

Avelo is a single Next.js (App Router) + TypeScript application. The App Router renders the caregiver-facing screens; Next.js API routes implement voice extraction, estimation, and booking endpoints. There is no separate backend service and no production database. All demo state (form drafts, bookings, scenario state, transcripts) lives in a minimal, per-demo-session in-memory store that is explicitly documented as non-production and fully reset-friendly.

This document is the Technical and Interaction Design for Avelo and must be read together with `requirements.md`. Every field name, screen name, scenario name, and state name used below matches `requirements.md` exactly.

## Architecture

### Technology choices

- **Framework:** Next.js (App Router) with TypeScript, single codebase, no separate backend service (Requirements 92, 93, 94).
- **UI layer:** App Router pages/components render the Landing, Booking Form, Estimate & Review, Booking Status, Arrangement Details screens and the Demo Controls surface (Requirements 9-16).
- **API layer:** Next.js API routes (route handlers under `app/api/**/route.ts`) implement:
  - `POST /api/voice/extract` — voice transcript interpretation into a field patch.
  - `POST /api/estimate` — price estimation.
  - Suggested-pickup-time calculation is exposed as part of `/api/estimate` (it is a pure derived value computed server-side alongside pricing, since both are driven by the same route fixture).
  - `POST /api/booking/request`, `GET /api/booking/:id`, `POST /api/booking/:id/accept-price`, `POST /api/booking/:id/find-another`, `POST /api/booking/:id/replace` — booking submission and state transitions.
  - `POST /api/demo/load-scenario`, `POST /api/demo/reset` — demo scenario control/reset.
- **Persistence:** a single process-wide, in-memory `BookingStore`, keyed by a `demoSessionId` (a random id minted per browser session and held in a cookie or `sessionStorage`). Optionally file-backed (a JSON snapshot on disk) purely as a convenience for restart recovery during development — never a requirement for correctness. This is explicitly **not** a production data store: it is single-process, unauthenticated, and has no durability guarantee across restarts (Requirement 96). No real customer data is collected; all data is fictional demo data (Requirements 7, 27, 83).
- **Secrets:** no secret ever ships in the client bundle. Any real speech-to-text or LLM extraction provider key is read **only** server-side from environment variables (e.g. `AI_EXTRACTION_PROVIDER`, `AI_EXTRACTION_API_KEY`) inside a provider adapter module that never executes in a browser context. The default adapter implementation requires no credentials at all (the deterministic fallback) (Requirements 49, 50, 99).

### High-level component diagram (textual)

```
Browser (App Router pages/components)
  ├─ Landing, BookingFormPage, EstimateReviewPage, BookingStatusPage, ArrangementDetailsPage
  ├─ DemoControlsPanel (rendered in a persistent layout slot, discreet)
  ├─ VoiceCaptureControl (uses browser SpeechRecognition API directly)
  └─ fetch() calls to API routes below
        │
        ▼
Next.js API routes (server-side only)
  ├─ /api/voice/extract      → VoiceExtractionAdapter → FieldMergeEngine
  ├─ /api/estimate           → PricingEngine + PickupTimeCalculator
  ├─ /api/booking/*          → FormValidator + BookingStateMachine + MatchingSimulator + BookingStore
  └─ /api/demo/*             → DemoScenarioRunner + BookingStore
        │
        ▼
BookingStore (in-memory, per demoSessionId, optionally file-snapshotted)
```

## Domain Vocabulary

| Term | Definition |
|---|---|
| **Caregiver** | The person using Avelo to arrange transportation on behalf of the Passenger; provides `caregiver.name` and `caregiver.phone`. |
| **Passenger** | The mobility-limited person being transported; identified only by `passenger.name`. |
| **Companion** | A person (count only, `requirements.companionCount`) who rides along with the Passenger but is not the Caregiver or the driver. |
| **Outbound Leg** | The first half of the round trip: pickup at `outbound.pickupAddress`, destination `outbound.destinationName` / `outbound.destinationAddress`, arriving by `outbound.requiredArrivalTime`, departing at the derived `outbound.suggestedPickupTime`. |
| **Return Leg** | The second half of the round trip, on the same trip date: pickup at `return.pickupTime` from `return.originAddress` (defaults to `outbound.destinationAddress`) to `return.destinationAddress` (defaults to `outbound.pickupAddress`). |
| **Required Arrival Time** | `outbound.requiredArrivalTime` — the time the Passenger must arrive at the outbound destination; caregiver-entered. |
| **Suggested Pickup Time** | `outbound.suggestedPickupTime` — a read-only, derived value: Required Arrival Time minus route travel duration minus the documented buffer. |
| **Return Pickup Time** | `return.pickupTime` — a fixed, caregiver-chosen time for the return leg; must be later than the Required Arrival Time. |
| **Route Fixture** | A documented, deterministic lookup entry keyed by an address/distance-tier pair, providing a travel duration (minutes) and a distance tier used by both the pickup-time calculation and pricing. |
| **Vehicle Accessibility Category** | A fixed enum describing the vehicle type needed: `standard` or `wheelchair-accessible`, derived from `requirements.mobility`. |
| **Estimate** | The computed `{ outboundEstimate, returnEstimate, total, specialRequestPending, suggestedPickupTime, explanation }` object returned by `/api/estimate`, shown on Estimate & Review. |
| **Special Request** | The free-text `requirements.specialRequests` field; non-empty value triggers the special-request pricing notice and `specialRequestPending`. |
| **Price Revision** | A change from the original Estimate total proposed by the simulated matching process after a candidate is found, requiring explicit caregiver approval. |
| **Candidate Provider** | A fictional provider proposed by `MatchingSimulator` as a possible match; existence of a Candidate Provider alone never implies booking confirmation. |
| **Accepted Provider** | A Candidate Provider that has accepted the trip (at the original price or a revised price the caregiver has approved). |
| **Confirmed Booking** | A booking in the `Confirmed` state: an Accepted Provider exists and the price (original or caregiver-approved revision) is settled. |
| **Replacement Request** | A caregiver-initiated request, with a reason, to find a new provider for an already-Confirmed Booking; the original Confirmed Booking is retained until the replacement finalizes. |
| **Booking Reference** | A short, human-readable identifier (`bookingId`) shown on Arrangement Details. |
| **Demo Scenario** | One of the named, deterministic fixture-driven flows: `standard`, `special-request-revision`, `replacement`, or the optional `unavailable-provider`. |

## Pages and Navigation

```
Landing
  └─(Schedule a Ride)──▶ Booking Form
                              │ (all required fields valid)
                              ▼
                       Estimate & Review ──(Edit)──▶ Booking Form (preserves all entered data)
                              │ (Request Arrangement)
                              ▼
                       Booking Status ──(Confirmed)──▶ Arrangement Details ──(Request a Different Arrangement)──▶ Booking Status (Replacement flow)

Demo Controls: a persistent, discreet surface available from every screen (e.g. a collapsed tab/drawer), never part of the primary caregiver task flow.
```

Exact navigation rules:

- **Landing → Booking Form**: triggered only by the single "Schedule a Ride" CTA (Requirement 2).
- **Booking Form → Estimate & Review**: triggered by a "Review Estimate" action, only reachable once `FormValidator` reports zero errors; calls `/api/estimate` and transitions to Estimate & Review with the returned Estimate attached to the in-memory draft.
- **Estimate & Review → Booking Form ("Edit")**: returns to Booking Form with the entire `BookingFormData` draft preserved exactly as entered — no field is cleared or reset (Requirement 13).
- **Booking Form → Estimate & Review (re-entry after Edit)**: any edit to a pricing/time-relevant field (pickup address, destination address, trip date, required arrival time, mobility/accessibility, companion count) marks the held Estimate as **stale**; Estimate & Review refuses to render a stale Estimate and instead forces a fresh `/api/estimate` call before display (Requirement 71). Non-relevant field edits (e.g. caregiver phone, special-requests text content change that doesn't flip empty↔non-empty) do not invalidate the Estimate.
- **Estimate & Review → Booking Status**: triggered by "Request Arrangement", which calls `/api/booking/request` with the validated form and the (non-stale) accepted Estimate; this is the single point at which the caregiver authorizes the arrangement at the displayed price (Requirement 62).
- **Booking Status → Arrangement Details**: automatic once the booking reaches `Confirmed`.
- **Arrangement Details → Replacement flow**: "Request a Different Arrangement" opens `ReplacementRequestDialog`; on submission with a reason, the booking re-enters a searching sub-flow while Arrangement Details continues to show the original Confirmed Booking until the replacement finalizes (Requirement 81).
- **Demo Controls**: reachable from any screen via a discreet, non-blocking affordance (e.g. a small labeled tab fixed to a screen edge). Opening it never navigates away from the current screen; it overlays/drawers in place.

## Components and Interfaces

### Frontend components

| Component | Responsibility | Inputs | Outputs |
|---|---|---|---|
| `BookingFormPage` | Hosts the booking form, orchestrates manual + voice + typed-NL input into one `BookingFormData` draft, drives validation display, and shows a section-completion progress indicator across the Caregiver & Passenger / Outbound / Return / Requirements sub-sections. | current draft, validation errors | emits draft changes, triggers "Review Estimate" |
| `VoiceCaptureControl` | Owns mic button + browser `SpeechRecognition` lifecycle (listening/transcribing/updating), prevents concurrent recordings. | user click, recognition events | transcript text, capture state |
| `TranscriptPanel` | Displays the most recent transcript and the plain-English update summary. | transcript, patch summary | — |
| `FieldChangeHighlighter` | Applies a brief visual highlight to fields changed by the latest voice/typed-NL patch. | list of changed field paths | — |
| `ValidationErrorSummary` | Renders an accessible, focusable list of current validation errors; drives focus-to-first-invalid-field on submit attempts. | validation errors | focus target |
| `EstimateBreakdown` | Renders outbound/return/total amounts and the derivation explanation for suggested pickup time. | `Estimate` | — |
| `SpecialRequestNotice` | Renders the exact required notice string when `requirements.specialRequests` is non-empty. | specialRequests presence | — |
| `PaymentReassuranceNotice` | Renders a short, fixed reassurance that no real payment is collected in this demo, shown on Estimate & Review alongside the price breakdown. | — | — |
| `BookingStatusView` | Renders the current `BookingStateMachine` state with state-specific actions (Accept New Price / Find Another Option, etc.). | booking status payload | user action events |
| `ArrangementDetailsCard` | Renders booking reference, provider, vehicle/accessibility, passenger/companion info, both legs, price/status. | confirmed booking | — |
| `ReplacementRequestDialog` | Collects a replacement reason; keyboard-operable modal with focus trap. | open/close, reason text | submit event |
| `DemoControlsPanel` | Lets a presenter load example data, pick a scenario, and reset; discreetly placed, always labeled as demo tooling. | scenario selection, reset click | `/api/demo/*` calls |

### Backend/domain modules

| Module | Responsibility | Inputs | Outputs |
|---|---|---|---|
| `FormValidator` | Single shared validation ruleset applied identically to manual and voice-populated data. | `BookingFormData` (partial or full) | `ValidationError[]` (field path, message, code) |
| `VoiceExtractionAdapter` | Interface for turning a transcript + context into a field patch. Two implementations: **real** (calls a configured LLM provider server-side) and **deterministic-fallback** (regex/keyword rules, default, zero external calls). | `{ transcript, currentFormSnapshot, nowISO }` | `{ patch, resolvedLeg?, clarificationNeeded?, source }` |
| `FieldMergeEngine` | Applies a field patch to a form draft per the precise merge semantics (see below). | current draft, patch, editVersion | new draft, applied-fields list, rejected (stale) flag |
| `PricingEngine` | Deterministic price calculation from route fixture + accessibility category + both legs + special-request flag. | leg distance tiers, accessibility category, specialRequests presence | `{ outboundEstimate, returnEstimate, total, specialRequestPending }` |
| `PickupTimeCalculator` | Deterministic suggested-pickup-time derivation and same-day bounds check. | `requiredArrivalTime`, route fixture travel duration, buffer | `{ suggestedPickupTime }` or `{ error: 'OUT_OF_BOUNDS', message }` |
| `MatchingSimulator` | Pure function deciding whether a Candidate Provider satisfies service area, times, wheelchair accommodation, companion capacity, assistance options, both legs; drives accept/revise/unmatched outcomes per the active Demo Scenario. | booking request, scenario fixture | candidate outcome (`accepted-same-price` \| `accepted-revised-price` \| `unmatched`) |
| `BookingStateMachine` | Sole source of truth for booking status; validates every transition against the documented transition table; rejects duplicate/impossible transitions. | current state, event | new state or rejection |
| `DemoScenarioRunner` | Drives `BookingStateMachine` + `MatchingSimulator` deterministically per the selected Demo Scenario fixture, with fixed (non-random) simulated delays. | scenario id, booking id | sequenced state transitions |
| `BookingStore` | In-memory (optionally file-snapshotted) storage of drafts, bookings, transcripts, and scenario state, scoped per `demoSessionId`/epoch. | reads/writes keyed by session id | current session state |

## Data Models

### Form Schema

```typescript
interface BookingFormData {
  caregiver: {
    name: string;        // required; non-empty after trim
    phone: string;       // required; must match a basic phone-number pattern
  };
  passenger: {
    name: string;        // required; non-empty after trim
  };
  outbound: {
    pickupAddress: string;          // required; non-empty after trim (basic completeness only, not verified)
    destinationName: string;        // required; non-empty after trim (e.g. hospital/clinic name)
    destinationAddress: string;     // required; non-empty after trim
    tripDate: string;               // required; ISO date (YYYY-MM-DD); must be today or later in America/New_York
    requiredArrivalTime: string;    // required; ISO time (HH:mm); combined with tripDate must be a real, future, meaningful instant
    suggestedPickupTime: string | null; // derived, read-only; null until successfully calculated; never user-editable
  };
  return: {
    pickupTime: string;             // required; ISO time (HH:mm); combined with tripDate must be later than requiredArrivalTime
    originAddress: string;          // optional on entry; defaults to outbound.destinationAddress when left blank; editable
    destinationAddress: string;     // optional on entry; defaults to outbound.pickupAddress when left blank; editable
  };
  requirements: {
    mobility: 'can-transfer' | 'must-remain-in-wheelchair'; // required; one of the two literal values
    companionCount: number;         // required; integer >= 0, capped at a documented maximum (e.g. 4)
    specialRequests: string;        // optional; free text; '' means none
  };
}
```

Same-day assumption: `return` has no separate date field. The return leg always occurs on `outbound.tripDate` (Requirement 26).

Field requirement/validation summary:

| Field | Required | Validation rule |
|---|---|---|
| `caregiver.name` | required | non-empty after trim |
| `caregiver.phone` | required | matches basic phone pattern |
| `passenger.name` | required | non-empty after trim |
| `outbound.pickupAddress` | required | non-empty after trim |
| `outbound.destinationName` | required | non-empty after trim |
| `outbound.destinationAddress` | required | non-empty after trim |
| `outbound.tripDate` | required | valid ISO date, >= today in America/New_York |
| `outbound.requiredArrivalTime` | required | valid ISO time; combined with tripDate must be a future instant |
| `outbound.suggestedPickupTime` | derived (not user-input) | must successfully resolve (not `OUT_OF_BOUNDS`) before Estimate & Review can display it |
| `return.pickupTime` | required | valid ISO time; `tripDate`+`pickupTime` strictly later than `tripDate`+`requiredArrivalTime` |
| `return.originAddress` | optional | defaults to `outbound.destinationAddress`; if provided, non-empty after trim |
| `return.destinationAddress` | optional | defaults to `outbound.pickupAddress`; if provided, non-empty after trim |
| `requirements.mobility` | required | must be `'can-transfer'` or `'must-remain-in-wheelchair'` |
| `requirements.companionCount` | required | integer, `0 <= n <= 4` |
| `requirements.specialRequests` | optional | free text, any length within a documented max (e.g. 500 chars) |

## API Contracts

All endpoints return errors in one consistent shape:

```typescript
interface ApiError {
  error: {
    code: string;       // e.g. 'VALIDATION_FAILED', 'STALE_VERSION', 'INVALID_STATE_TRANSITION', 'OUT_OF_BOUNDS', 'NOT_FOUND', 'DUPLICATE_REQUEST'
    message: string;    // plain-English, user-safe
    details?: unknown;  // structured info, e.g. ValidationError[]
  };
}
```

Status codes used consistently: `200` success, `400` validation/bad input, `404` unknown booking/session, `409` invalid state transition or duplicate submission, `422` unprocessable AI extraction output, `500` unexpected server error.

### Voice transcription

Transcription itself happens **client-side** via the browser's `SpeechRecognition` (Web Speech API), chosen as primary because it requires no server round-trip and no API key for the default experience. There is no server transcription endpoint; the client sends the already-transcribed text to `/api/voice/extract`. If `SpeechRecognition` is unsupported, `VoiceCaptureControl` detects this via feature probing (`'SpeechRecognition' in window || 'webkitSpeechRecognition' in window`) and falls back to showing a typed-natural-language text input that is sent to the same `/api/voice/extract` endpoint (Requirement 48).

### `POST /api/voice/extract`

```typescript
interface VoiceExtractRequest {
  transcript: string;
  currentFormSnapshot: BookingFormData;
  nowISO: string; // caller-supplied "now", resolved against America/New_York for relative dates
  formEditVersion: number; // monotonic version of the form draft at capture time
}

interface VoiceExtractResponse {
  patch: Partial<FormFieldPatch>;   // see Field Merge Engine below
  resolvedLeg?: 'outbound' | 'return';
  clarificationNeeded?: string;     // plain-English question; if set, patch is empty
  resolvedRelativeDate?: string;    // echoed ISO date when a relative date phrase was resolved
  confidence: number;               // 0..1
  source: 'deterministic-fallback' | 'llm';
}
```

### `POST /api/estimate`

```typescript
interface EstimateRequest {
  outbound: Pick<BookingFormData['outbound'], 'pickupAddress' | 'destinationAddress' | 'tripDate' | 'requiredArrivalTime'>;
  return: Pick<BookingFormData['return'], 'pickupTime' | 'originAddress' | 'destinationAddress'>;
  requirements: BookingFormData['requirements'];
}

interface EstimateResponse {
  outboundEstimate: number;     // USD, 2 decimal places
  returnEstimate: number;
  total: number;                // outboundEstimate + returnEstimate
  specialRequestPending: boolean;
  suggestedPickupTime: string;  // ISO time, derived
  explanation: string;          // e.g. "Suggested pickup: 8:30 AM, allowing 60 minutes for travel and a 30-minute arrival buffer."
}
```

If the suggested-pickup calculation is out of bounds, this endpoint returns `400` with `code: 'OUT_OF_BOUNDS'` and an actionable message instead of a shifted time.

### `POST /api/booking/request`

```typescript
interface BookingRequestBody {
  form: BookingFormData;
  acceptedEstimate: EstimateResponse; // must match a freshly-computed estimate for the same form; stale estimates are rejected (400 STALE_ESTIMATE)
}

interface BookingRequestResponse {
  bookingId: string;
  status: BookingStatus; // see state machine
}
```

Duplicate guard: a second `POST /api/booking/request` for a session that already has a non-Draft booking returns `409 DUPLICATE_REQUEST`.

### `GET /api/booking/:id`

```typescript
interface BookingStatusResponse {
  bookingId: string;
  status: BookingStatus;
  originalEstimate: EstimateResponse;
  revisedEstimate?: { total: number; difference: number; reason: string };
  provider?: { name: string; vehicleType: string; accessibilityEquipment: string[] };
  form: BookingFormData; // includes requirements.specialRequests, retained throughout
}
```

### `POST /api/booking/:id/accept-price`

No body. Returns `BookingStatusResponse` with `status: 'Confirmed'`. `409` if the booking is not currently `ProviderProposedRevision`.

### `POST /api/booking/:id/find-another`

No body. Returns `BookingStatusResponse` with `status: 'Searching'`. `409` if the booking is not currently `ProviderProposedRevision`.

### `POST /api/booking/:id/replace`

```typescript
interface ReplaceRequestBody { reason: string; } // required, non-empty
```

Returns `BookingStatusResponse` with `status: 'ReplacementSearching'`. `409` if the booking is not currently `Confirmed`.

### `POST /api/demo/load-scenario`

```typescript
interface LoadScenarioRequest { scenario: 'standard' | 'special-request-revision' | 'replacement' | 'unavailable-provider'; }
interface LoadScenarioResponse { demoSessionId: string; form: BookingFormData; }
```

### `POST /api/demo/reset`

```typescript
interface ResetResponse { demoSessionId: string; epoch: number; } // new session id and epoch; old one is invalidated
```

## Voice Extraction and Field Merge Rules

### `FieldMergeEngine` contract

```typescript
type FormFieldPatch = {
  [K in keyof BookingFormData as `${string & K}`]?: Partial<BookingFormData[K]> | { __clear: true };
};

interface MergeResult {
  draft: BookingFormData;
  appliedFields: string[];     // dotted paths actually changed
  rejectedStale: boolean;      // true if the patch's editVersion was older than the draft's current version
}

function applyPatch(
  draft: BookingFormData,
  draftEditVersion: number,
  patch: FormFieldPatch,
  patchEditVersion: number
): MergeResult;
```

Precise semantics:

1. **Mentioned-only update:** a key present in `patch` with a concrete value replaces that field (or nested sub-object field) in `draft`. Any field path not present anywhere in `patch` is left byte-identical in the output (Requirements 30, 35, 42).
2. **Missing = no-op:** omission of a field from `patch` is never interpreted as "clear this field." Only an explicit `{ __clear: true }` marker on a field clears it (Requirement 37).
3. **Leg resolution:** when the extractor cannot structurally tell whether a mentioned detail (e.g. a time or location) belongs to `outbound` or `return`, the `VoiceExtractionAdapter` first applies a small resolution heuristic (e.g. presence of "pick up"/"drop off"/"return"/"coming home" cues, or match against an address that already equals the *other* leg's counterpart address) and sets `resolvedLeg`. `FieldMergeEngine` then writes only into that leg's sub-object. If resolution is not possible, no patch is produced at all for that detail (see uncertainty below) (Requirement 33).
4. **Uncertainty detection:** the deterministic-fallback extractor scans for uncertainty markers ("not sure", "maybe", "or", "I think", "something like") immediately around a candidate value. If found, that field is omitted from `patch` entirely and `clarificationNeeded` is set to a focused, plain-English question instead. The merge engine never receives a guessed value for that field (Requirement 40).
5. **Self-correction within an utterance:** the fallback extractor's per-field regex scan always keeps the **last** match for each field type found in the transcript (e.g. two time-like substrings → the later one in the string wins), so only the final stated value appears in `patch` (Requirement 39).
6. **Clarification preserves state:** whenever `clarificationNeeded` is set, `patch` is `{}` — applying it is a guaranteed no-op, so the prior draft is returned unchanged (Requirement 34).
7. **Versioning/ordering:** every form draft carries a monotonic `editVersion`, incremented on every applied patch (voice or manual). Each `VoiceExtractRequest` captures the draft's `formEditVersion` at the time recording started. If, by the time the extraction response arrives, the live draft's `editVersion` is higher than `formEditVersion`, the merge is still attempted but is computed as a **rebase**: fields in the patch are applied on top of the *current* draft, except fields that have themselves been edited (manually or by a newer voice patch) since `formEditVersion` — those are left as-is and the stale sub-change is dropped (`rejectedStale: true` is reported per-field, not for the whole patch), ensuring an older AI response never overwrites a newer edit (Requirement 44).
8. **Relative-date resolution:** phrases like "next Tuesday" are resolved by the extractor against the caller-supplied `nowISO`, interpreted in `America/New_York`, producing a concrete ISO date that is echoed back as `resolvedRelativeDate` and displayed to the caregiver for confirmation (Requirement 41).
9. **Undo-last-voice-patch:** `BookingStore` retains, per field, the value immediately prior to the most recent **voice-sourced** patch that touched it, plus the `editVersion` at which that prior value held. "Undo last voice update" restores only those fields to that prior value, and only if no subsequent (voice or manual) edit has touched the field since; fields edited after the voice patch are left untouched (Requirement 47).
10. **No auto-submit:** the merge pipeline has no reference to, and never calls, the booking-submission action; submission is reachable only from an explicit "Request Arrangement" click (Requirement 43).

### Deterministic fallback extractor (non-LLM)

Clearly labeled in UI (`source: 'deterministic-fallback'`) and in code comments. Implementation approach: a small, ordered set of regex/keyword rules run against the lower-cased transcript:

- **Name patterns:** `/(?:for|passenger is|name is)\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/i` → candidate passenger/caregiver name, disambiguated by preceding keyword ("passenger"/"my name").
- **Time patterns:** `/\b(\d{1,2})(:\d{2})?\s*(am|pm)\b/gi`, last match per leg-relevant context wins (self-correction rule).
- **Place/hospital patterns:** capitalized multi-word sequences following "from", "to", "at", or a curated list of destination keywords ("hospital", "clinic", "center").
- **Mobility keywords:** "wheelchair" + "stay"/"remain" → `must-remain-in-wheelchair`; "transfer"/"can get into the seat" → `can-transfer`.
- **Uncertainty keywords:** listed in rule 4 above, scanned within a fixed token window around any matched value.
- **Leg cue keywords:** "pick up", "coming home", "return", "drop off", "on the way back".

This rule set is intentionally small and documented in one module so its behavior is auditable and reproducible; it makes no network calls.

### Real extractor adapter interface

```typescript
interface VoiceExtractionAdapter {
  extract(input: {
    transcript: string;
    currentFormSnapshot: BookingFormData;
    nowISO: string;
  }): Promise<{
    patch: FormFieldPatch;
    resolvedLeg?: 'outbound' | 'return';
    clarificationNeeded?: string;
    resolvedRelativeDate?: string;
    confidence: number;
  }>;
}
```

Both the deterministic-fallback implementation and any real LLM-backed implementation satisfy this same interface; the API route selects one based on `AI_EXTRACTION_PROVIDER` (unset → fallback) and tags the response with the correct `source`. All output from either implementation is validated against the `FormFieldPatch` shape by `FormValidator`-adjacent schema checks before ever reaching `FieldMergeEngine` (Requirement 95).

## Estimation Rules

Deterministic fixture table (`routeFixtures`), keyed by a fictional address-pair id, each entry providing a **distance tier** and **travel duration**:

| Distance tier | Travel duration (min) | Base fare (per leg) |
|---|---|---|
| short | 15 | $18 |
| medium | 35 | $32 |
| long | 60 | $52 |
| rural-long | 90 | $75 |

Accessibility category multiplier:

| `requirements.mobility` | Vehicle Accessibility Category | Multiplier |
|---|---|---|
| `can-transfer` | standard | 1.0x |
| `must-remain-in-wheelchair` | wheelchair-accessible | 1.4x |

Per-leg calculation: `legEstimate = baseFare(distanceTier) * accessibilityMultiplier`, rounded to 2 decimals.

Worked example — outbound tier `long` (60 min, base $52), `must-remain-in-wheelchair`:
`outboundEstimate = 52 * 1.4 = $72.80`.
Return tier `medium` (base $32), same accessibility:
`returnEstimate = 32 * 1.4 = $44.80`.
`total = 72.80 + 44.80 = $117.60`.

Special-request pending flag: `specialRequestPending = requirements.specialRequests.trim().length > 0`. When `true`, pricing is still returned immediately (never deferred to a manual-quote step — Requirement 58); the `SpecialRequestNotice` component shows the exact required string:

> "This estimate may not include additional costs for special requests. We will confirm these with the provider. If the price changes, we will notify you and ask for your approval before confirming the booking."

## Suggested Pickup-Time Calculation

Formula:

```
suggestedPickupTime = requiredArrivalTime - travelDuration(routeFixture) - buffer
```

Documented fixed buffer: **30 minutes**, applied uniformly to every route fixture (never traffic-based — Requirement 70).

Worked example (matches AC-TIME-01): `requiredArrivalTime = 10:00 AM`, `travelDuration = 60 min`, `buffer = 30 min`:
`suggestedPickupTime = 10:00 − 00:60 − 00:30 = 08:30 AM`.
Explanation string shown to the caregiver: *"Suggested pickup: 8:30 AM, allowing 60 minutes for travel and a 30-minute arrival buffer."*

Same-day bounds check: if `requiredArrivalTime − travelDuration − buffer` would fall before `00:00` on `outbound.tripDate`, `PickupTimeCalculator` returns `{ error: 'OUT_OF_BOUNDS', message: "A pickup this early would fall on the previous day, which isn't supported. Please choose a later arrival time or an earlier trip date." }` instead of silently shifting the date (Requirement 72). `/api/estimate` surfaces this as a `400 OUT_OF_BOUNDS` response.

## Booking State Transitions

```typescript
type BookingStatus =
  | 'Draft' | 'EstimateReady' | 'RequestSubmitted' | 'Searching' | 'CandidateFound'
  | 'ProviderAcceptedSamePrice' | 'ProviderProposedRevision' | 'Confirmed'
  | 'Unmatched' | 'UnableToArrange'
  | 'ReplacementRequested' | 'ReplacementSearching' | 'ReplacementFound' | 'ReplacementConfirmed';
```

The Booking Status screen (Requirement 14) displays one of five caregiver-facing labels, each mapped from one or more internal `BookingStatus` values so the internal state machine and the user-facing copy never diverge:

| Internal `BookingStatus` value(s) | Caregiver-facing label |
|---|---|
| `RequestSubmitted`, `Searching`, `CandidateFound`, `ReplacementRequested`, `ReplacementSearching`, `ReplacementFound` (while still resolving toward same-price acceptance) | "Finding a Provider" |
| `ProviderProposedRevision` | "Price Update: Action Required" |
| `Confirmed`, `ReplacementConfirmed` | "Booking Confirmed" |
| `Searching` reached via "Find Another Option" (i.e. after a prior `ProviderProposedRevision`) | "Searching for Another Provider" |
| `UnableToArrange` | "Unable to Arrange This Trip" |

```
Draft
  → (form valid) → EstimateReady
  → (Request Arrangement) → RequestSubmitted
  → (auto) → Searching
  → (candidate found) → CandidateFound
  → (candidate price == original total) → ProviderAcceptedSamePrice → (auto) → Confirmed
  → (candidate price != original total) → ProviderProposedRevision
        → (Accept New Price and Confirm) → Confirmed
        → (Find Another Option) → Searching
  → (no viable candidate) → Unmatched → (auto) → UnableToArrange

Confirmed
  → (Request a Different Arrangement, reason) → ReplacementRequested
  → (auto) → ReplacementSearching
  → (replacement candidate found) → ReplacementFound
        → (same price) → ReplacementConfirmed
        → (revised price) → (same accept/find-another approval loop as above) → ReplacementConfirmed | ReplacementSearching
  (the original Confirmed booking's provider/price remain the system of record and are shown on Arrangement Details until ReplacementConfirmed is reached)
```

Transition table:

| From | Event | To | Guard |
|---|---|---|---|
| Draft | `formBecomesValid` | EstimateReady | `FormValidator` reports zero errors and a fresh Estimate exists |
| EstimateReady | `requestArrangement` | RequestSubmitted | no existing non-Draft booking for this session (duplicate guard) |
| RequestSubmitted | `autoStartSearch` | Searching | — |
| Searching | `candidateFound` | CandidateFound | candidate passes `MatchingSimulator` guard checks |
| CandidateFound | `priceMatches` | ProviderAcceptedSamePrice | candidate price == original total |
| ProviderAcceptedSamePrice | `autoConfirm` | Confirmed | — |
| CandidateFound | `priceDiffers` | ProviderProposedRevision | candidate price != original total |
| ProviderProposedRevision | `acceptNewPrice` | Confirmed | — |
| ProviderProposedRevision | `findAnother` | Searching | — |
| Searching | `noViableCandidate` | Unmatched | scenario fixture signals no match |
| Unmatched | `autoFinalize` | UnableToArrange | — |
| Confirmed | `requestReplacement` | ReplacementRequested | booking is currently Confirmed; reason provided |
| ReplacementRequested | `autoStartSearch` | ReplacementSearching | — |
| ReplacementSearching | `candidateFound` | ReplacementFound | candidate passes `MatchingSimulator` guard checks |
| ReplacementFound | `priceMatches` | ReplacementConfirmed | candidate price == original total |
| ReplacementFound | `priceDiffers` | ProviderProposedRevision (replacement variant) | candidate price != original total |
| (replacement) ProviderProposedRevision | `acceptNewPrice` | ReplacementConfirmed | — |
| (replacement) ProviderProposedRevision | `findAnother` | ReplacementSearching | — |
| *any* | `requestArrangement` while status != Draft/EstimateReady | *rejected, 409* | duplicate-submission guard |
| *any* | event not listed for current state | *rejected, 409* | impossible-transition guard |

Explicit statement: `CandidateFound` is a distinct state from `Confirmed` and from `ProviderAcceptedSamePrice`; no code path treats `CandidateFound` as sufficient for a Confirmed Booking (Requirement 73). The duplicate-submission guard and the impossible-transition guard are both enforced inside `BookingStateMachine.transition(currentState, event)`, which is the only function permitted to mutate booking status (Requirement 77, 98).

## Error Handling

All API routes share the single `ApiError` shape and status-code conventions defined under API Contracts above (`VALIDATION_FAILED`, `STALE_VERSION`, `INVALID_STATE_TRANSITION`, `OUT_OF_BOUNDS`, `NOT_FOUND`, `DUPLICATE_REQUEST`, plus `422` for unprocessable AI extraction output and `500` for unexpected errors). Two cross-cutting rules govern every error path:

1. **Never silently degrade data.** A failed or ambiguous operation (voice extraction failure, stale estimate, duplicate booking attempt, out-of-bounds pickup time) always returns an explicit, typed error and leaves prior state untouched rather than guessing, defaulting, or partially applying a change.
2. **Every error is user-facing in plain English.** Server error codes map to a plain-English message shown by the relevant component (`ValidationErrorSummary`, `BookingStatusView`, `VoiceCaptureControl`), never a raw stack trace or technical code shown to the caregiver.

The concrete voice, validation, and booking error/loading states are enumerated below.

## Error and Loading States

**Voice:**
- `listening` (mic active, no result yet)
- `transcribing` (speech captured, awaiting transcript finalization)
- `updating` (transcript sent to `/api/voice/extract`, awaiting patch)
- `permission-denied` (mic access denied — show manual/typed-text fallback)
- `unsupported-browser` (no SpeechRecognition — show typed-text fallback immediately, no mic button shown as primary)
- `no-speech-detected` (recognition ended with no result — offer retry)
- `recording-failure` (recognition API error — offer retry or manual entry)
- `transcription-failure` (empty/garbled transcript — form unchanged, offer retry)
- `ai-timeout` (extraction request exceeded a fixed timeout, e.g. 8s — form unchanged, offer retry or manual entry)
- `invalid-extraction` (response fails schema validation — form unchanged, offer retry or manual entry)

Every failure state leaves the form exactly as it was (Requirement 36, 48) and always offers at least one of: retry, manual entry, typed-text input.

**Validation:**
- inline field errors (red border + icon + text, never color alone)
- `ValidationErrorSummary` (accessible list, `role="alert"` region)
- focus management: on blocked submit, focus moves to the summary first, or directly to the first invalid field, and the page scrolls it into view (Requirement 53)

**Booking:**
- `request-submission-failure` (network/server error on `/api/booking/request` — form/estimate retained, retry offered)
- `matching-timeout` (scenario-driven search exceeds its fixed demo delay without resolving — shown as part of `Searching`, not a separate error state, since the Demo Scenario guarantees eventual resolution)
- `unable-to-arrange` (terminal `UnableToArrange` state — honest messaging, no implication that a request is guaranteed fulfillable)

## Persistence and Reset Behavior

Stored in `BookingStore`, keyed by `demoSessionId`:
- current `BookingFormData` draft + `editVersion`
- per-field "prior value before last voice patch" (for undo)
- transcript history (latest transcript + summary)
- in-flight voice capture/extraction state
- current booking (if any) and its full state-machine history
- active Demo Scenario id and its scheduled timers

Storage is strictly in-memory (an optional on-disk JSON snapshot may mirror it for dev convenience only); it is **not** multi-instance safe and is **not** intended to survive a server restart as a guarantee — this limitation is documented in the README (Requirement 96).

Reset behavior (`POST /api/demo/reset`): the server
1. increments a per-session **epoch** counter,
2. clears the form draft, booking, validation errors, transcript, undo history, and any scheduled `DemoScenarioRunner` timers tied to the old epoch (cancelling them outright),
3. mints a fresh `demoSessionId` tied to the new epoch, and returns it to the client, which immediately switches to using it,
4. tags every subsequent async response (voice extraction, matching delay callbacks) with the epoch that was current when the request was issued; `BookingStore` compares the response's epoch to the session's *current* epoch and **silently discards** any response whose epoch is stale, guaranteeing a late response from a reset session can never repopulate the new session (Requirements 85, 86).

## Accessibility

- Semantic landmarks (`<header>`, `<main>`, `<nav>`, `<footer>`) and a correct heading hierarchy on every screen.
- ARIA live regions (`role="status"`/`aria-live="polite"`) announce voice state changes (listening/transcribing/updating) and the update summary; `role="alert"`/`aria-live="assertive"` for validation error summaries and booking-status changes that need immediate attention (e.g. price revision).
- Focus management: on blocked submit, focus moves to the error summary or first invalid field; on every screen transition (Landing→Form, Form→Review, Review→Status, Status→Details), focus moves to the new screen's heading.
- Errors always use icon + text + color together, never color alone (Requirement 57).
- All interactive elements (mic button, dialogs, buttons) are fully keyboard-operable; `ReplacementRequestDialog` and the price-revision modal implement a focus trap while open and return focus to the triggering element on close.
- Visible focus rings on every focusable element (no `outline: none` without a replacement focus style).
- Minimum touch target size of 44x44px for buttons and the mic control.
- A small set of documented responsive breakpoints (part of the design-tokens module) so every screen remains usable and legible on both mobile and desktop widths (Requirement 8).
- Plain-English copy throughout; no jargon, no unexplained abbreviations (Requirement 91).

## Demo Fixtures and Scenario Controls

Required fixtures (fictional names only):

**`standard`** — Caregiver "Rose Daniels" booking for passenger "Walter Daniels", `must-remain-in-wheelchair`, complete outbound+return schedule, no special requests. Fixed simulated search delay: 2s → `CandidateFound` → price matches → auto `Confirmed`. Provider: "Pioneer Valley Rides", standard wheelchair van.

**`special-request-revision`** — Caregiver "Linda Ortiz" booking for passenger "Marco Ortiz", `can-transfer`, special request "needs help carrying an oxygen tank". Fixed delay: 2s → `CandidateFound` → price differs (+$15, reason: "additional assistance for medical equipment") → `ProviderProposedRevision`; demo exposes both the accept-new-price path (→ `Confirmed`) and the find-another path (→ `Searching` → same candidate re-offered at original price on retry, for repeatability).

**`replacement`** — Starts from an already-`Confirmed` booking (reusing the `standard` fixture's data), presenter triggers "Request a Different Arrangement" with reason "original provider's vehicle became unavailable" → `ReplacementSearching` (2s) → `ReplacementFound` with provider "Berkshire Accessible Transport" at the same price → `ReplacementConfirmed`.

**`unavailable-provider`** *(optional)* — Caregiver "Diane Marsh" booking for passenger "Harold Marsh", rural-long tier with wheelchair + 3 companions (exceeds any fixture's companion capacity) → `Searching` (2s) → `Unmatched` → `UnableToArrange`.

`DemoScenarioRunner` drives these deterministically: each scenario is a fixed, ordered list of `{ delayMs, event }` steps (no randomness anywhere), executed with `setTimeout`-equivalent timers tagged with the session epoch. Re-running the same scenario id against a fresh session always reproduces the identical sequence (idempotent, Requirement 84). `DemoControlsPanel` offers: "Load Example Data" (per scenario), a scenario picker, and a "Reset" button; it is rendered as a discreet, collapsed drawer/tab so it never competes visually with the caregiver-facing flow (Requirement 78).

## External Dependencies and Fallback Behavior

- **Browser `SpeechRecognition` API** (client-side, primary): feature-detected at `VoiceCaptureControl` mount; when absent, the mic button is replaced by a labeled typed-natural-language text input wired to the same `/api/voice/extract` endpoint, so the extraction pipeline is identical either way.
- **Real LLM extraction provider** (optional, server-side only): selected via `AI_EXTRACTION_PROVIDER` env var; its API key (`AI_EXTRACTION_API_KEY`) is read only in the API route process, never bundled to the client. When `AI_EXTRACTION_PROVIDER` is unset, the deterministic-fallback adapter is used automatically.
- The UI always displays which extractor is active (`source: 'deterministic-fallback' | 'llm'`), sourced directly from the API response, never guessed client-side.
- With no environment variables configured, the entire application — including voice capture, extraction, pricing, matching, and booking — runs end-to-end with **zero outbound network calls**, satisfying the requirement that the demo always works without external credentials (Requirements 49, 50).

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Patch mentions govern change, omission preserves, explicit clear removes

For any form draft and any field patch, applying the patch SHALL change only the fields explicitly present in the patch (with a concrete value), SHALL leave every field absent from the patch byte-identical to its prior value, and SHALL clear a field if and only if that field carries an explicit `{ __clear: true }` marker.

**Validates: Requirements 30, 35, 36, 37, 38, 42**

### Property 2: Latest edit wins on overlapping fields regardless of source

For any two sequential patches (manual or voice, in either order of source) that both mention the same field, the field's value after applying both in chronological order SHALL equal the value from the later patch, while any field mentioned only by the earlier patch SHALL retain that earlier patch's value.

**Validates: Requirements 31, 32, 38**

### Property 3: Leg resolution confines the patch to the resolved leg

For any voice patch for which the extractor resolves a target leg, applying that patch SHALL modify only fields within the resolved leg's sub-object and SHALL leave the other leg's sub-object unchanged.

**Validates: Requirements 33**

### Property 4: Ambiguity and uncertainty block definite values and preserve state

For any transcript the extractor classifies as leg/field-ambiguous or as expressing explicit uncertainty around a candidate value, the resulting patch SHALL be empty, `clarificationNeeded` SHALL be non-empty, and applying the (empty) patch to any draft SHALL leave that draft unchanged.

**Validates: Requirements 34, 40**

### Property 5: Self-correction within an utterance keeps only the final value

For any transcript containing two or more sequential mentions of a value for the same field, the extracted patch SHALL contain only the last-mentioned value for that field.

**Validates: Requirements 39**

### Property 6: Stale responses never regress newer edits

For any sequence of patches applied with monotonically increasing edit versions, the final draft SHALL reflect, for every field, the value from the highest-versioned patch that mentioned it, regardless of the order in which responses arrive over the network.

**Validates: Requirements 44**

### Property 7: Undo-last-voice-patch reverts only untouched fields

For any history of a voice patch followed by zero or more later edits, invoking undo-last-voice-patch SHALL restore to their pre-patch values exactly those fields the voice patch changed and that were not subsequently edited, and SHALL leave every other field (including fields manually edited after the voice patch) unchanged.

**Validates: Requirements 47**

### Property 8: Concurrent mic activation never starts a second capture

For any sequence of mic-button click events, at most one active recording/extraction session SHALL exist at any point in time.

**Validates: Requirements 45**

### Property 9: Validator flags exactly the invalid fields

For any `BookingFormData` with exactly one field made invalid per its documented rule (past trip date, non-future required-arrival instant, return pickup not later than required arrival, companion count out of range, missing mobility selection, missing required text field), `FormValidator` SHALL report an error for that field and SHALL report zero errors for a fully valid form.

**Validates: Requirements 56**

### Property 10: Pricing is deterministic and total is additive

For any route-fixture distance tier and accessibility category, computing the Estimate twice from identical inputs SHALL yield identical `outboundEstimate`, `returnEstimate`, and `total` values, and `total` SHALL always equal `outboundEstimate + returnEstimate`; `specialRequestPending` SHALL be `true` if and only if `requirements.specialRequests` is non-empty after trimming.

**Validates: Requirements 59, 60**

### Property 11: Suggested pickup time equals arrival minus duration minus buffer, or a bounds error

For any required arrival time and route fixture travel duration, the computed suggested pickup time SHALL equal `requiredArrivalTime − travelDuration − 30 minutes` when that result falls on the same calendar day, and SHALL instead be an explicit `OUT_OF_BOUNDS` error when it would not. This is the formal statement of acceptance criterion AC-TIME-01.

**Validates: Requirements 68, 72**

### Property 12: Relevant-field edits invalidate a held Estimate

For any held Estimate and any subsequent edit to a pricing/time-relevant field (pickup address, destination address, trip date, required arrival time, mobility, companion count), the held Estimate SHALL be marked stale, and Estimate & Review SHALL require a fresh `/api/estimate` result before display.

**Validates: Requirements 71**

### Property 13: Same-price candidates confirm automatically; differing prices require explicit approval

For any `CandidateFound` booking, if the candidate's price equals the original Estimate total, the booking SHALL transition to `Confirmed` without any additional caregiver action; if the candidate's price differs, the booking SHALL transition to `ProviderProposedRevision` and SHALL remain there until exactly one of `acceptNewPrice` (→ `Confirmed`) or `findAnother` (→ `Searching`) is invoked. This is the formal statement of acceptance criteria AC-BOOKING-01 and AC-PRICE-01.

**Validates: Requirements 63, 64, 65, 66**

### Property 14: Only documented transitions are reachable, and duplicate submissions are rejected

For any booking and any sequence of events, `BookingStateMachine` SHALL reach only states connected by an edge present in the documented transition table, and a `requestArrangement` event on a booking that is not currently `Draft`/`EstimateReady` SHALL be rejected without changing the booking's state.

**Validates: Requirements 73, 77, 98**

### Property 15: Matching never selects a candidate failing a hard requirement

For any booking request and any candidate provider fixture, `MatchingSimulator` SHALL never return that candidate as accepted if it lacks the required Vehicle Accessibility Category, lacks sufficient companion capacity, or does not cover both legs' service area.

**Validates: Requirements 74**

### Property 16: Special requests remain attached through every subsequent view

For any booking submitted with a non-empty `requirements.specialRequests`, every later `GET /api/booking/:id` response for that booking SHALL include that exact `specialRequests` text unchanged, through every state transition.

**Validates: Requirements 75**

### Property 17: Extractor output is schema-validated before merge, with no partial pass-through

For any raw extractor output, including malformed shapes, the server SHALL either produce a `FormFieldPatch` fully conforming to the documented schema or reject the entire response with no effect on form state; it SHALL never apply a partially-invalid patch.

**Validates: Requirements 95**

### Property 18: Reset invalidates the prior session irrevocably

For any session epoch `E` and any async response tagged with an epoch earlier than the session's current epoch, `BookingStore` SHALL discard that response and SHALL NOT apply it to the current (post-reset) session state. This is the formal statement of acceptance criterion AC-DEMO-01.

**Validates: Requirements 85, 86**

### Property 19: Demo scenarios are deterministic and idempotent across runs

For any Demo Scenario id, running it twice from a freshly reset session SHALL produce the identical ordered sequence of state transitions and identical fixture data both times.

**Validates: Requirements 79, 80, 81, 82, 84**

### Property 20: Return-leg defaults derive from the outbound leg until overridden

For any outbound leg values, initializing or re-deriving the return leg (when the caregiver has not explicitly overridden it) SHALL set `return.originAddress` to `outbound.destinationAddress` and `return.destinationAddress` to `outbound.pickupAddress`; once explicitly overridden by the caregiver, further outbound edits SHALL NOT revert the override.

**Validates: Requirements 22**

## Testing Strategy

**Unit/example tests** cover: exact special-request notice string presence/absence, the honest "Unable to Arrange" messaging for the `unavailable-provider` scenario, screen-level navigation/focus behavior, specific voice-failure-state UI, and specific leg-disambiguation phrase examples (e.g. "hospital pickup" on the return leg).

**Property-based tests** (minimum 100 iterations each, tagged `Feature: avelo, Property {n}: {title}`) cover Properties 1-20 above, implemented against the pure domain modules (`FieldMergeEngine`, `FormValidator`, `PricingEngine`, `PickupTimeCalculator`, `BookingStateMachine`, `MatchingSimulator`'s guard logic, and the deterministic-fallback extractor's regex rules), independent of UI rendering, per the project's documented testing decisions.

**End-to-end journey tests** cover the four full caregiver journeys named in Testing Decisions: Standard Arrangement, Special Request / Price Revision, Replacement, and repeat-after-reset.
