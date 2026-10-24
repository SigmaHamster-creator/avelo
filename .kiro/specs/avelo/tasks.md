# Implementation Plan: Avelo

## Overview

This plan converts `requirements.md` and `design.md` into an ordered, vertically-sliced build sequence. Slice 0 (not one of the seven product slices) is a required prerequisite: it stands up the Next.js + TypeScript shell, the visual tokens, and the accessibility scaffolding that every later slice renders into. Slices 1-7 then follow the exact order requested: manual booking form and validation, estimation and review, simulated matching and confirmation, voice extraction and incremental updates, special-request price revision, replacement request, and finally demo controls/polish/deployment/submission materials.

Every leaf task below references the exact module, component, endpoint, type, and state names defined in `design.md` (e.g. `FieldMergeEngine`, `BookingStateMachine`, `MatchingSimulator`, `BookingStore`, `POST /api/voice/extract`, `BookingFormData`, `EstimateResponse`, `EstimateReviewPage`, `BookingStatusPage`, `ArrangementDetailsPage`, the five caregiver-facing status labels) so there is no drift between the design vocabulary and the implementation tasks. Each page task also names the design.md screen it implements (`Estimate & Review`, `Booking Status`, `Arrangement Details`) and the named component it hosts (`EstimateBreakdown`/`SpecialRequestNotice`, `BookingStatusView`, `ArrangementDetailsCard`).

### Legend (per-task metadata keys used below)

- **Layer**: `frontend` | `backend` | `domain-logic` | `integration` | `testing` | `documentation`
- **Deps**: prerequisite task IDs that must be complete first
- **I/O**: concrete inputs consumed and outputs produced by this task
- **UX**: the expected user-visible (caregiver or presenter) behavior that results
- **Errors**: error paths and edge cases this task must handle
- **Interactive**: for tasks that introduce a button/control/dialog — label, enabled/disabled condition, action, loading behavior, resulting feedback, failure behavior, next state/destination
- **AC**: the acceptance criteria this specific task must satisfy to be considered done
- **Verify**: the verification method (property-based test, unit test, e2e journey test, type-check, manual review)
- **Mode**: `real` (working logic/code, not a stand-in), `simulated` (fictional/fixture-driven demo behavior per the product's documented scope), or `pluggable` (real by default-off adapter, simulated fallback always on)
- `_Requirements:_` — the specific requirement numbers (or AC-seed IDs) from `requirements.md` this task satisfies

Sub-tasks marked `*` are test tasks and are optional (skippable for a faster MVP pass) per the Fast Task workflow convention; they are not implemented by an automated task-execution pass unless explicitly un-skipped. Top-level tasks are never marked optional.

---

## Tasks

*(Section C: Development Task Plan)*

### 0. Project scaffolding (prerequisite, not one of the seven product slices)

This slice does not appear in the user's seven product slices; it is inserted first because every later slice renders UI into this shell and every later screen must already match the documented palette and accessibility baseline.

- [ ] 0.1 Initialize the Next.js (App Router) + TypeScript project
  - Layer: integration
  - Deps: none
  - I/O: none in → a runnable Next.js + TypeScript workspace, `tsconfig.json`, `package.json`, lint config out
  - UX: none directly (no screen yet); enables `npm run dev` to serve a blank app
  - Errors: n/a
  - AC: project builds (`next build`) and type-checks with zero errors; single codebase, no separate backend service (Requirements 92, 93, 94)
  - Verify: run `next build` and `tsc --noEmit`
  - Mode: real
  - _Requirements: 92, 93, 94_

- [ ] 0.2 Define design tokens and global theme (palette, typography, spacing, touch targets)
  - Layer: frontend
  - Deps: 0.1
  - I/O: none in → a shared tokens module/CSS (cream background, white cards, dark green text, soft teal primary action color, accessible red error color; large type scale; generous spacing scale; 44x44px minimum touch-target size; a small set of responsive breakpoints so the same tokens scale cleanly from mobile to desktop widths) out
  - UX: establishes the warm, calm, approachable visual baseline every screen inherits, on both desktop and mobile
  - Errors: n/a
  - AC: tokens match Requirement 87 palette exactly; touch target and type-scale values documented in one place (Requirement 88); breakpoints documented in one place (Requirement 8)
  - Verify: visual/manual review against the documented palette; unit test asserting token values exist and match the documented hex/scale constants
  - Mode: real
  - _Requirements: 8, 87, 88, 89_

- [ ] 0.3 Build the base App Router layout with semantic landmarks and accessibility shell
  - Layer: frontend
  - Deps: 0.1, 0.2
  - I/O: none in → root layout with `<header>`, `<main>`, `<nav>`, `<footer>`, a skip-to-content link, a correct heading-hierarchy convention, and persistent ARIA live-region containers (`role="status"`/`aria-live="polite"` and `role="alert"`/`aria-live="assertive"`) out
  - UX: every screen gets consistent landmarks, visible keyboard focus rings (no `outline: none` without replacement), and a slot the Demo Controls affordance will later use
  - Errors: n/a
  - AC: landmarks and heading hierarchy present on an empty page; focus ring visible on every focusable element by default
  - Verify: unit test asserting landmark roles exist; manual keyboard-navigation review
  - Mode: real
  - _Requirements: 90, 88_

- [ ] 0.4 Set up unit/property-based and end-to-end testing frameworks
  - Layer: testing
  - Deps: 0.1
  - I/O: test runner config (unit + property-based, e.g. a Jest/Vitest-equivalent plus a fast-check-equivalent library for the target language, selected consistently with the language already detected for this workspace) and an e2e runner config in → `npm test` / `npm run test:e2e` scripts out
  - UX: none directly
  - Errors: n/a
  - AC: a placeholder test runs and passes under both the unit/property runner and the e2e runner
  - Verify: run the configured test commands once with a trivial passing test
  - Mode: real
  - _Requirements: 93_

- [ ] 0.5 Checkpoint — scaffolding verified
  - Ensure the project builds, type-checks, and the placeholder tests pass; ask the user if questions arise before starting Slice 1.

### 1. Manual booking form and validation

- [ ] 1.1 Build the Landing screen content and the "Schedule a Ride" CTA navigation
  - Layer: frontend
  - Deps: 0.3
  - I/O: none in → Landing screen with brand name, tagline, short explanation, one concise non-emergency statement, and a single CTA out
  - UX: caregiver sees the brand/tagline/explanation and exactly one "Schedule a Ride" button
  - Errors: n/a
  - Interactive: **"Schedule a Ride" button** — label "Schedule a Ride"; always enabled; action navigates to the Booking Form screen; no loading state (pure client navigation); no failure case; next destination: Booking Form screen
  - AC: landing page states the product is for non-emergency transportation only, concisely and only once (no repeated warnings elsewhere); exactly one CTA present
  - Verify: unit test asserting single CTA and presence of the non-emergency statement text
  - Mode: real
  - _Requirements: 1, 2, 3, 4, 9_

- [ ] 1.2 Define `BookingFormData` and `FormFieldPatch` shared TypeScript types
  - Layer: domain-logic
  - Deps: 0.1
  - I/O: none in → exported `BookingFormData` (caregiver, passenger, outbound, return, requirements sub-objects, field-for-field as in design.md "Form Schema") and `FormFieldPatch` types out, used by every later task
  - UX: none directly
  - Errors: n/a
  - AC: shape matches design.md's Form Schema table exactly, including `outbound.suggestedPickupTime: string | null` being read-only/derived
  - Verify: `tsc --noEmit`; manual diff against the design.md Form Schema table
  - Mode: real
  - _Requirements: 6, 17, 18, 19, 21, 22, 23, 26_

- [ ] 1.3 Implement the `BookingStore` draft module (per-session in-memory draft + `editVersion`)
  - Layer: backend
  - Deps: 1.2
  - I/O: `demoSessionId` in → current `BookingFormData` draft and a monotonic `editVersion`, incremented on every applied patch, out
  - UX: none directly; underlies every later screen's persistence
  - Errors: unknown `demoSessionId` → treated as a fresh/empty draft, never a crash
  - AC: `editVersion` increments exactly once per applied patch (manual or voice); storage is explicitly in-memory, single-process, non-durable-across-restart (documented inline, Requirement 96)
  - Verify: unit test incrementing `editVersion` across sequential writes
  - Mode: real (simplified, non-production persistence per documented scope)
  - _Requirements: 96_

- [ ] 1.4 Implement the `FormValidator` shared validation module
  - Layer: domain-logic
  - Deps: 1.2
  - I/O: a (partial or full) `BookingFormData` in → `ValidationError[]` (field path, message, code) out, per the Field requirement/validation summary table in design.md
  - UX: none directly (consumed by UI in 1.12/1.13)
  - Errors: covers every rule in the table: required contact/passenger fields, required pickup/destination fields, future trip date, meaningful required arrival time, return pickup time later than required arrival time, companion count `0..4`, required mobility selection
  - AC: identical rule set is usable from both manual-edit and voice-patch code paths (single shared module, no duplicated logic)
  - Verify: see 1.5 (property test) plus manual diff against the Field requirement/validation summary table
  - Mode: real
  - _Requirements: 51, 56_

- [ ] 1.5* Property test — `FormValidator` flags exactly the invalid fields
  - Layer: testing
  - Deps: 1.4
  - **Property 9: Validator flags exactly the invalid fields**
  - **Validates: Requirements 56**
  - Verify: property-based test, minimum 100 iterations, tagged `Feature: avelo, Property 9: Validator flags exactly the invalid fields`, run against `FormValidator` directly (no UI)
  - Mode: real

- [ ] 1.6 Build the `BookingFormPage` shell wired to the `BookingStore` draft
  - Layer: frontend
  - Deps: 1.3, 0.3
  - I/O: current draft + validation errors in → draft-change events out (per design.md's `BookingFormPage` responsibility row)
  - UX: navigating from Landing lands on a page that loads (or initializes) the current draft; every manual field edit increments `editVersion` via `BookingStore`; a section-completion progress indicator (e.g. "2 of 4 sections complete") reflects how many of the Caregiver & Passenger / Outbound / Return / Requirements sub-sections currently pass validation
  - Errors: load failure falls back to an empty, valid-shape draft rather than crashing
  - AC: page renders with zero fields populated on a fresh session and with prior values restored after an "Edit" return (verified later in 2.13); progress indicator updates as each sub-section becomes valid
  - Verify: unit test asserting draft round-trips through the page shell; unit test asserting the progress indicator reflects per-section validity
  - Mode: real
  - _Requirements: 10, 11_

- [ ] 1.7 Build the Caregiver & Passenger manual input fields (sub-component used within `BookingFormPage`)
  - Layer: frontend
  - Deps: 1.6
  - I/O: `caregiver.name`, `caregiver.phone`, `passenger.name` in/out
  - UX: each field has a clear label and helper text explaining why it is requested; no medical/demographic fields beyond these
  - Errors: none at this layer (validation display added in 1.12)
  - AC: exactly the fields listed exist, each with label + helper text
  - Verify: unit test asserting labels/helper text present for all three fields
  - Mode: real
  - _Requirements: 17, 18, 24, 25_

- [ ] 1.8 Build the Outbound leg manual input fields (sub-component used within `BookingFormPage`)
  - Layer: frontend
  - Deps: 1.6
  - I/O: `outbound.pickupAddress`, `outbound.destinationName`, `outbound.destinationAddress`, `outbound.tripDate`, `outbound.requiredArrivalTime` in/out; `outbound.suggestedPickupTime` rendered read-only (populated later in Slice 2)
  - UX: labeled fields with helper text; `suggestedPickupTime` shown as a non-editable, clearly "derived" value placeholder until Slice 2 computes it
  - Errors: none at this layer
  - AC: `suggestedPickupTime` is never rendered as an editable input
  - Verify: unit test asserting the derived field has no input role
  - Mode: real
  - _Requirements: 19, 20, 24_

- [ ] 1.9 Build the Return leg manual input fields + return-leg-default-from-outbound derivation (sub-component used within `BookingFormPage`)
  - Layer: frontend
  - Deps: 1.6
  - I/O: `return.pickupTime`, `return.originAddress`, `return.destinationAddress` in/out; reads `outbound.destinationAddress`/`outbound.pickupAddress` to compute defaults
  - UX: `return.originAddress` defaults to `outbound.destinationAddress` and `return.destinationAddress` defaults to `outbound.pickupAddress` whenever the caregiver has not explicitly overridden them; once overridden, further outbound edits never revert the override
  - Errors: none at this layer
  - AC: default derivation matches Property 20 exactly
  - Verify: see 1.10
  - Mode: real
  - _Requirements: 22, 26_

- [ ] 1.10* Property test — return-leg defaults derive from outbound until overridden
  - Layer: testing
  - Deps: 1.9
  - **Property 20: Return-leg defaults derive from the outbound leg until overridden**
  - **Validates: Requirements 22**
  - Verify: property-based test, minimum 100 iterations, tagged `Feature: avelo, Property 20: Return-leg defaults derive from the outbound leg until overridden`
  - Mode: real

- [ ] 1.11 Build the Requirements fields (mobility, companionCount, specialRequests) (sub-component used within `BookingFormPage`)
  - Layer: frontend
  - Deps: 1.6
  - I/O: `requirements.mobility` (`'can-transfer' | 'must-remain-in-wheelchair'`), `requirements.companionCount` (integer 0-4), `requirements.specialRequests` (free text) in/out
  - UX: clear label + helper text per field; mobility rendered as an explicit two-option selection (no default pre-selection that could be mistaken for caregiver intent)
  - Errors: none at this layer
  - AC: exactly the two literal mobility values are selectable; companion count input constrained to the documented range in the UI as well as in `FormValidator`
  - Verify: unit test asserting the two mobility options and the companion-count bounds
  - Mode: real
  - _Requirements: 23, 24, 25_

- [ ] 1.12 Implement inline field validation error rendering wired to `FormValidator`
  - Layer: frontend
  - Deps: 1.4, 1.7, 1.8, 1.9, 1.11
  - I/O: current draft + `ValidationError[]` in → red border + icon + text per invalid field out
  - UX: a resolved error disappears the moment its field becomes valid, without disturbing any other field's entered value; errors are never color-only; mic and manual editing remain fully usable while errors are present
  - Errors: covers every rule from 1.4; multiple simultaneous errors each render independently
  - AC: icon+text+color always co-occur on an error; fixing one field's error never clears or alters another field's value
  - Verify: unit test fixing one field and asserting siblings are untouched; manual color-contrast review
  - Mode: real
  - _Requirements: 11, 52, 54, 55, 57_

- [ ] 1.13 Implement `ValidationErrorSummary` + focus/scroll-to-first-invalid on blocked submit attempt
  - Layer: frontend
  - Deps: 1.12
  - I/O: current `ValidationError[]` in → an accessible, focusable `role="alert"` error list out
  - UX: attempting to proceed while errors remain blocks progress, shows the accessible summary, and moves keyboard focus (with scroll-into-view) to the summary or the first invalid field
  - Errors: zero errors ⇒ summary does not render
  - Interactive: implicit via the (not-yet-built) "Review Estimate" button in Slice 2 — this task only prepares the summary/focus target it will use
  - AC: matches AC-VALIDATION-01's focus/summary requirement
  - Verify: unit test asserting focus moves to the summary (or first invalid field) on a blocked attempt
  - Mode: real
  - _Requirements: 52, 53_

- [ ] 1.14* Unit test — resolved error disappears without disturbing other fields
  - Layer: testing
  - Deps: 1.13
  - Verify: unit test: populate two invalid fields, fix one, assert only that one error clears and the other field's value/error is untouched
  - _Requirements: 55_

- [ ] 1.15 Checkpoint — manual form + validation verified
  - Ensure all Slice 1 tests pass; ask the user if questions arise before starting Slice 2.

### 2. Estimation and review

- [ ] 2.1 Define the route fixtures and accessibility-multiplier data module
  - Layer: domain-logic
  - Deps: 0.1
  - I/O: none in → the `routeFixtures` table (distance tier → travel duration minutes, base fare) and the mobility→Vehicle Accessibility Category→multiplier table, exactly as documented in design.md's Estimation Rules out
  - UX: none directly
  - Errors: n/a
  - AC: values match design.md's tables exactly (short/medium/long/rural-long tiers; 1.0x/1.4x multipliers)
  - Verify: unit test asserting the worked example (`long` tier, `must-remain-in-wheelchair` ⇒ $72.80) reproduces exactly
  - Mode: simulated (deterministic demo fixture, documented as such)
  - _Requirements: 27, 59_

- [ ] 2.2 Implement the `PricingEngine` module
  - Layer: domain-logic
  - Deps: 2.1
  - I/O: leg distance tiers, accessibility category, `specialRequests` presence in → `{ outboundEstimate, returnEstimate, total, specialRequestPending }` out
  - UX: none directly (consumed by 2.6)
  - Errors: n/a (pure function)
  - AC: `total == outboundEstimate + returnEstimate`; `specialRequestPending == (requirements.specialRequests.trim().length > 0)`
  - Verify: see 2.3
  - Mode: simulated (deterministic fixture-driven pricing, documented as non-live)
  - _Requirements: 59, 60_

- [ ] 2.3* Property test — pricing is deterministic and the total is additive
  - Layer: testing
  - Deps: 2.2
  - **Property 10: Pricing is deterministic and total is additive**
  - **Validates: Requirements 59, 60**
  - Verify: property-based test, minimum 100 iterations, tagged `Feature: avelo, Property 10: Pricing is deterministic and total is additive`
  - Mode: simulated

- [ ] 2.4 Implement the `PickupTimeCalculator` module
  - Layer: domain-logic
  - Deps: 2.1
  - I/O: `requiredArrivalTime`, route fixture travel duration, documented 30-minute buffer in → `{ suggestedPickupTime }` or `{ error: 'OUT_OF_BOUNDS', message }` out
  - UX: none directly (consumed by 2.6)
  - Errors: a result before `00:00` on `outbound.tripDate` returns the explicit `OUT_OF_BOUNDS` error object instead of shifting the date
  - AC: formula exactly `requiredArrivalTime − travelDuration − 30min`; worked example reproduces `08:30 AM` from `10:00 AM` / 60 min
  - Verify: see 2.5
  - Mode: simulated (deterministic fixture-driven, never traffic-based — Requirement 70)
  - _Requirements: 68, 70, 72_

- [ ] 2.5* Property test — suggested pickup time formula or explicit bounds error
  - Layer: testing
  - Deps: 2.4
  - **Property 11: Suggested pickup time equals arrival minus duration minus buffer, or a bounds error (AC-TIME-01)**
  - **Validates: Requirements 68, 72**
  - Verify: property-based test, minimum 100 iterations, tagged `Feature: avelo, Property 11: Suggested pickup time equals arrival minus duration minus buffer, or a bounds error`
  - Mode: simulated

- [ ] 2.6 Implement `POST /api/estimate`
  - Layer: backend
  - Deps: 2.2, 2.4, 1.2
  - I/O: `EstimateRequest` (outbound/return/requirements subset) in → `EstimateResponse` (`outboundEstimate`, `returnEstimate`, `total`, `specialRequestPending`, `suggestedPickupTime`, `explanation`) out, or `400 OUT_OF_BOUNDS` with an actionable message
  - UX: caregiver always receives a price immediately, even with a non-empty `specialRequests` (never deferred to a manual-quote step)
  - Errors: request-shape validation failure → `400 VALIDATION_FAILED`; `PickupTimeCalculator` bounds failure → `400 OUT_OF_BOUNDS` (not a silently shifted date); unexpected failure → `500` with a plain-English `ApiError`
  - AC: response shape matches `EstimateResponse` exactly; `explanation` string format matches `"Suggested pickup: 8:30 AM, allowing 60 minutes for travel and a 30-minute arrival buffer."`
  - Verify: integration test posting a known fixture and asserting the exact response and explanation string
  - Mode: simulated
  - _Requirements: 58, 59, 60, 68, 69, 72_

- [ ] 2.7 Wire the "Review Estimate" button on the Booking Form screen
  - Layer: frontend
  - Deps: 2.6, 1.13
  - I/O: current draft in → `POST /api/estimate` call, navigation to the Estimate & Review screen with the returned `EstimateResponse` attached to the draft out
  - UX: button is disabled while `FormValidator` reports any error; enabled only when zero errors
  - Errors: `400`/`500` from the endpoint keeps the caregiver on the Booking Form screen with a plain-English error and the draft fully intact
  - Interactive: **"Review Estimate" button** — label "Review Estimate"; enabled only when `FormValidator` reports zero errors (Requirement 54); action calls `POST /api/estimate` then navigates; loading: button shows a busy/loading state and is disabled during the in-flight request; success feedback: navigation to Estimate & Review; failure feedback: plain-English inline error, draft untouched, button returns to its normal enabled state; next state: Estimate & Review screen (success) or remains on Booking Form (failure)
  - AC: never reachable while any validation error exists
  - Verify: unit test asserting the button's disabled/enabled states and the navigation-on-success path
  - Mode: real (UI/wiring) over simulated (pricing) data
  - _Requirements: 13, 54, 97_

- [ ] 2.8 Build the Estimate & Review screen (`EstimateReviewPage`) hosting `EstimateBreakdown` and `PaymentReassuranceNotice`
  - Layer: frontend
  - Deps: 2.7
  - I/O: `EstimateResponse` + draft in → rendered passenger/caregiver info, outbound/return details, required arrival time, suggested pickup time + explanation, mobility/assistance needs, price breakdown, and `PaymentReassuranceNotice`'s "no real payment is collected in this demo" text out
  - UX: caregiver sees everything needed to confirm correctness before requesting an arrangement; explanation text never implies live traffic; caregiver is reassured no real payment is ever collected
  - Errors: n/a at this layer (upstream errors handled in 2.6/2.7)
  - AC: all fields listed in Requirement 12 are present on screen; the no-real-payment reassurance text is present
  - Verify: unit test asserting presence of each required field group and the reassurance text
  - Mode: real (rendering) of simulated pricing data
  - _Requirements: 12, 67, 69, 70_

- [ ] 2.9 Build `SpecialRequestNotice`
  - Layer: frontend
  - Deps: 2.8
  - I/O: `requirements.specialRequests` presence in → the exact required notice string out, rendered only when non-empty after trim
  - UX: caregiver with a special request sees the exact sentence; caregivers without one see nothing extra
  - Errors: n/a
  - AC: renders the string verbatim: "This estimate may not include additional costs for special requests. We will confirm these with the provider. If the price changes, we will notify you and ask for your approval before confirming the booking."
  - Verify: see 2.10
  - Mode: real
  - _Requirements: 61_

- [ ] 2.10* Unit test — exact special-request notice string present/absent
  - Layer: testing
  - Deps: 2.9
  - Verify: unit test asserting the notice renders verbatim when `specialRequests` is non-empty and does not render when empty/whitespace-only
  - _Requirements: 61_

- [ ] 2.11 Implement stale-estimate invalidation on relevant-field edits
  - Layer: domain-logic
  - Deps: 2.8, 1.6
  - I/O: a held `EstimateResponse` + a field-edit event in → the held estimate marked `stale` out, when the edited field is pickup address, destination address, trip date, required arrival time, mobility, or companion count
  - UX: Estimate & Review refuses to render a stale estimate and forces a fresh `POST /api/estimate` call before display; edits to non-relevant fields (e.g. caregiver phone, a `specialRequests` text edit that doesn't flip empty↔non-empty) never invalidate the held estimate
  - Errors: the refetch itself reuses the error handling from 2.6/2.7
  - AC: matches Property 12 exactly
  - Verify: see 2.12
  - Mode: real
  - _Requirements: 71_

- [ ] 2.12* Property test — relevant-field edits invalidate a held Estimate
  - Layer: testing
  - Deps: 2.11
  - **Property 12: Relevant-field edits invalidate a held Estimate**
  - **Validates: Requirements 71**
  - Verify: property-based test, minimum 100 iterations, tagged `Feature: avelo, Property 12: Relevant-field edits invalidate a held Estimate`
  - Mode: real

- [ ] 2.13 Wire the "Edit" action on the Estimate & Review screen
  - Layer: frontend
  - Deps: 2.8
  - I/O: current draft in → navigation back to the Booking Form screen with the entire `BookingFormData` draft preserved exactly as entered out
  - UX: no field is cleared or reset on return
  - Errors: n/a
  - Interactive: **"Edit" button** — label "Edit"; always enabled; action navigates back to the Booking Form screen; no loading state (client-side navigation only); no failure case; next state: Booking Form screen with draft intact
  - AC: a byte-identical draft round-trip (Estimate & Review → Edit → Booking Form) with no field loss
  - Verify: unit test asserting draft equality before/after the round trip
  - Mode: real
  - _Requirements: 13_

- [ ] 2.14 Checkpoint — estimation & review verified
  - Ensure all Slice 2 tests pass; ask the user if questions arise before starting Slice 3.

### 3. Simulated matching and confirmation

- [ ] 3.1 Define the `BookingStatus` type union + caregiver-facing label mapping
  - Layer: domain-logic
  - Deps: 1.2
  - I/O: none in → the `BookingStatus` union (`Draft`, `EstimateReady`, `RequestSubmitted`, `Searching`, `CandidateFound`, `ProviderAcceptedSamePrice`, `ProviderProposedRevision`, `Confirmed`, `Unmatched`, `UnableToArrange`, `ReplacementRequested`, `ReplacementSearching`, `ReplacementFound`, `ReplacementConfirmed`) and the mapping to the five caregiver-facing labels ("Finding a Provider", "Price Update: Action Required", "Booking Confirmed", "Searching for Another Provider", "Unable to Arrange This Trip") out
  - UX: none directly
  - Errors: n/a
  - AC: mapping matches design.md's table exactly, with no internal state left unmapped
  - Verify: `tsc --noEmit` exhaustiveness check (switch over the union with no default case) plus a unit test asserting every status maps to one of the five labels
  - Mode: real
  - _Requirements: 14_

- [ ] 3.2 Implement `BookingStateMachine`
  - Layer: domain-logic
  - Deps: 3.1
  - I/O: current state + event in → new state, or a rejection, per the documented Transition table out
  - UX: none directly (sole mutator of booking status for every later task)
  - Errors: an event not listed for the current state is rejected without changing state; a `requestArrangement` event while status is not `Draft`/`EstimateReady` is rejected as a duplicate
  - AC: `BookingStateMachine.transition(currentState, event)` is the only function permitted to mutate booking status; `CandidateFound` is never treated as sufficient for a confirmed booking
  - Verify: see 3.3
  - Mode: simulated (drives the simulated matching narrative; the state machine logic itself is real, deterministic code)
  - _Requirements: 73, 77, 98_

- [ ] 3.3* Property test — only documented transitions are reachable; duplicates rejected
  - Layer: testing
  - Deps: 3.2
  - **Property 14: Only documented transitions are reachable, and duplicate submissions are rejected**
  - **Validates: Requirements 73, 77, 98**
  - Verify: property-based test, minimum 100 iterations, tagged `Feature: avelo, Property 14: Only documented transitions are reachable, and duplicate submissions are rejected`
  - Mode: real

- [ ] 3.4 Implement `MatchingSimulator` guard logic
  - Layer: domain-logic
  - Deps: 3.1
  - I/O: booking request + scenario fixture in → candidate outcome (`accepted-same-price` | `accepted-revised-price` | `unmatched`) out
  - UX: none directly (drives 3.11's displayed state)
  - Errors: a candidate lacking service-area coverage, wheelchair accommodation, or companion capacity for either leg is never returned as accepted
  - AC: matches Property 15 exactly
  - Verify: see 3.5
  - Mode: simulated (fictional providers/candidates by design)
  - _Requirements: 74_

- [ ] 3.5* Property test — matching never selects a candidate failing a hard requirement
  - Layer: testing
  - Deps: 3.4
  - **Property 15: Matching never selects a candidate failing a hard requirement**
  - **Validates: Requirements 74**
  - Verify: property-based test, minimum 100 iterations, tagged `Feature: avelo, Property 15: Matching never selects a candidate failing a hard requirement`
  - Mode: simulated

- [ ] 3.6 Extend `BookingStore` with booking + state-machine history persistence
  - Layer: backend
  - Deps: 1.3, 3.2
  - I/O: `demoSessionId` in → current booking (if any) and its full `BookingStateMachine` transition history, keyed alongside the existing draft, out
  - UX: none directly
  - Errors: n/a
  - AC: history is append-only and queryable for the duplicate-submission guard in 3.8
  - Verify: unit test asserting history records every transition in order
  - Mode: real (simplified, non-production persistence)
  - _Requirements: 96, 98_

- [ ] 3.7 Implement `DemoScenarioRunner` + the `standard` scenario fixture
  - Layer: backend
  - Deps: 3.2, 3.4, 3.6
  - I/O: scenario id + booking id in → a fixed, ordered `{ delayMs, event }` step list executed against `BookingStateMachine`, tagged with the session epoch, out
  - UX: presenter/caregiver sees `Searching` → `CandidateFound` → `ProviderAcceptedSamePrice` → auto-`Confirmed` after a fixed 2s simulated delay, for caregiver "Rose Daniels" / passenger "Walter Daniels", provider "Pioneer Valley Rides"
  - Errors: no randomness anywhere; re-running the same scenario id from a fresh session reproduces the identical sequence
  - AC: matches the `standard` fixture exactly as documented in design.md's Demo Fixtures section
  - Verify: unit test running the `standard` scenario twice and diffing the two transition sequences
  - Mode: simulated (fictional caregiver/passenger/provider, fixed non-random timers)
  - _Requirements: 5, 79, 83, 84_

- [ ] 3.8 Implement `POST /api/booking/request`
  - Layer: backend
  - Deps: 3.6, 2.8, 3.2
  - I/O: `BookingRequestBody` (`form`, `acceptedEstimate`) in → `BookingRequestResponse` (`bookingId`, `status`) out
  - UX: this single action is the point at which the caregiver authorizes the arrangement at the displayed price
  - Errors: a stale/mismatched `acceptedEstimate` → `400 STALE_ESTIMATE`; a second request for a session with an existing non-Draft booking → `409 DUPLICATE_REQUEST`; invalid form → `400 VALIDATION_FAILED`
  - AC: never creates two bookings for the same session via double-click or retry
  - Verify: integration test asserting a duplicate immediate retry returns `409` and does not create a second booking
  - Mode: simulated (booking subject matter) over real request-handling code
  - _Requirements: 62, 98_

- [ ] 3.9 Implement `GET /api/booking/:id`
  - Layer: backend
  - Deps: 3.6
  - I/O: `bookingId` in → `BookingStatusResponse` (`bookingId`, `status`, `originalEstimate`, `revisedEstimate?`, `provider?`, `form`) out
  - UX: polling or on-navigation reads always reflect the current state-machine status
  - Errors: unknown id → `404 NOT_FOUND`
  - AC: `form.requirements.specialRequests` is present and unchanged on every call (feeds Property 16, verified in 5.7)
  - Verify: integration test reading a booking across two different states and asserting response shape both times
  - Mode: simulated
  - _Requirements: 14, 75_

- [ ] 3.10 Wire the "Request Arrangement" action on the Estimate & Review screen
  - Layer: frontend
  - Deps: 2.8, 3.8
  - I/O: validated form + non-stale `EstimateResponse` in → `POST /api/booking/request` call, navigation to the Booking Status screen out
  - UX: this is the single authorization point (Requirement 62)
  - Errors: `409 DUPLICATE_REQUEST`/`400`/`500` keep the caregiver on Estimate & Review with a plain-English error, estimate and form retained, retry offered
  - Interactive: **"Request Arrangement" button** — label "Request Arrangement"; enabled only when the held estimate is not stale; action calls `POST /api/booking/request` then navigates; loading: busy/disabled state during the in-flight request; success feedback: navigation to Booking Status; failure feedback: plain-English inline error, form/estimate retained, retry available; next state: Booking Status screen (success) or remains on Estimate & Review (failure)
  - AC: matches `request-submission-failure` handling in design.md's Error and Loading States
  - Verify: unit test asserting the error path retains form/estimate and offers retry
  - Mode: real (wiring) over simulated (booking) data
  - _Requirements: 62, 97_

- [ ] 3.11 Build the Booking Status screen (`BookingStatusPage`) hosting `BookingStatusView`
  - Layer: frontend
  - Deps: 3.9, 3.1
  - I/O: `BookingStatusResponse` in → one of the five caregiver-facing labels, state-specific actions, and a visible "matching is simulated" indicator out
  - UX: "Finding a Provider" is shown while searching; on reaching `Confirmed` the screen automatically advances to Arrangement Details with no extra click
  - Errors: n/a at this layer (polling/network errors reuse the generic `ApiError` display pattern)
  - AC: every screen showing provider/booking info clearly indicates simulated matching (Requirement 16)
  - Verify: unit test asserting the simulated-matching indicator is present and the auto-advance fires on `Confirmed`
  - Mode: real (rendering) of simulated matching state
  - _Requirements: 14, 16_

- [ ] 3.12 Build the Arrangement Details screen (`ArrangementDetailsPage`) hosting `ArrangementDetailsCard`
  - Layer: frontend
  - Deps: 3.9
  - I/O: confirmed booking in → booking reference, fictional provider, vehicle/accessibility equipment, passenger/companion info, both legs with times, price/status out
  - UX: one place to review a confirmed booking; simulated-matching indicator present (Requirement 16)
  - Errors: n/a at this layer
  - AC: all fields listed in Requirement 15 are present
  - Verify: unit test asserting presence of each required field group
  - Mode: real (rendering) of simulated provider data
  - _Requirements: 15, 16_

- [ ] 3.13* Property test — same-price candidate confirms automatically
  - Layer: testing
  - Deps: 3.7, 3.2
  - **Property 13: Same-price candidates confirm automatically; differing prices require explicit approval (same-price branch; AC-BOOKING-01)**
  - **Validates: Requirements 63**
  - Verify: property-based test, minimum 100 iterations, tagged `Feature: avelo, Property 13: Same-price candidates confirm automatically (same-price branch)`
  - Mode: simulated

- [ ] 3.14* End-to-end journey test — Standard Arrangement scenario
  - Layer: testing
  - Deps: 3.10, 3.11, 3.12, 3.7
  - Verify: e2e test driving Landing → Booking Form → Estimate & Review → Request Arrangement → Booking Status ("Finding a Provider") → auto-"Booking Confirmed" → Arrangement Details, using the `standard` demo scenario, asserting the full caregiver-visible path
  - Mode: simulated
  - _Requirements: 79_

- [ ] 3.15 Checkpoint — matching & confirmation verified
  - Ensure all Slice 3 tests pass; ask the user if questions arise before starting Slice 4.

### 4. Voice extraction and incremental updates

- [ ] 4.1 Define the `FormFieldPatch` merge contract and implement the base `FieldMergeEngine`
  - Layer: domain-logic
  - Deps: 1.2
  - I/O: current draft, `draftEditVersion`, `patch`, `patchEditVersion` in → `MergeResult` (`draft`, `appliedFields`, `rejectedStale`) out, implementing `applyPatch(draft, draftEditVersion, patch, patchEditVersion)` exactly as declared in design.md
  - UX: none directly
  - Errors: a key present in `patch` with a concrete value replaces that field; any field absent from `patch` is left byte-identical; only an explicit `{ __clear: true }` marker clears a field
  - AC: matches Property 1 exactly; the merge pipeline never references the booking-submission action (Requirement 43)
  - Verify: see 4.2
  - Mode: real
  - _Requirements: 30, 35, 37, 42, 43_

- [ ] 4.2* Property test — patch mentions govern change, omission preserves, explicit clear removes
  - Layer: testing
  - Deps: 4.1
  - **Property 1: Patch mentions govern change, omission preserves, explicit clear removes**
  - **Validates: Requirements 30, 35, 36, 37, 38, 42**
  - Verify: property-based test, minimum 100 iterations, tagged `Feature: avelo, Property 1: Patch mentions govern change, omission preserves, explicit clear removes`
  - Mode: real

- [ ] 4.3* Property test — latest edit wins on overlapping fields regardless of source
  - Layer: testing
  - Deps: 4.1
  - **Property 2: Latest edit wins on overlapping fields regardless of source**
  - **Validates: Requirements 31, 32, 38**
  - Verify: property-based test, minimum 100 iterations, tagged `Feature: avelo, Property 2: Latest edit wins on overlapping fields regardless of source`
  - Mode: real

- [ ] 4.4 Implement the deterministic-fallback `VoiceExtractionAdapter` base + leg-resolution heuristic
  - Layer: domain-logic
  - Deps: 4.1
  - I/O: `{ transcript, currentFormSnapshot, nowISO }` in → `{ patch, resolvedLeg?, confidence, source: 'deterministic-fallback' }` out, implementing the name/time/place/mobility regex rules and the leg-cue-keyword heuristic documented in design.md
  - UX: none directly (consumed by 4.16)
  - Errors: never invents a "home" address or an unspecified hospital name; when leg resolution is not possible, no patch is produced for that detail at all
  - AC: matches Property 3 exactly; makes zero network calls
  - Verify: see 4.5
  - Mode: simulated (clearly labeled, non-AI fallback, as required by Requirement 50)
  - _Requirements: 33, 42, 50_

- [ ] 4.5* Property test — leg resolution confines the patch to the resolved leg
  - Layer: testing
  - Deps: 4.4
  - **Property 3: Leg resolution confines the patch to the resolved leg**
  - **Validates: Requirements 33**
  - Verify: property-based test, minimum 100 iterations, tagged `Feature: avelo, Property 3: Leg resolution confines the patch to the resolved leg`
  - Mode: simulated

- [ ] 4.6 Implement uncertainty-marker detection + clarification question generation
  - Layer: domain-logic
  - Deps: 4.4
  - I/O: transcript + candidate field value in → the field omitted from `patch` entirely + a focused, plain-English `clarificationNeeded` question out, when an uncertainty marker ("not sure", "maybe", "or", "I think", "something like") appears in a fixed token window around the candidate value
  - UX: caregiver is asked a focused question instead of receiving a fabricated definite value
  - Errors: whenever `clarificationNeeded` is set, `patch` is `{}` — a guaranteed no-op
  - AC: matches Property 4 exactly
  - Verify: see 4.7
  - Mode: simulated
  - _Requirements: 34, 40_

- [ ] 4.7* Property test — ambiguity and uncertainty block definite values and preserve state
  - Layer: testing
  - Deps: 4.6
  - **Property 4: Ambiguity and uncertainty block definite values and preserve state**
  - **Validates: Requirements 34, 40**
  - Verify: property-based test, minimum 100 iterations, tagged `Feature: avelo, Property 4: Ambiguity and uncertainty block definite values and preserve state`
  - Mode: simulated

- [ ] 4.8 Implement self-correction last-match-wins regex scan
  - Layer: domain-logic
  - Deps: 4.4
  - I/O: a transcript containing two or more mentions of a value for the same field in → only the last-mentioned value included in `patch` out
  - UX: a mid-sentence self-correction is understood naturally
  - Errors: n/a
  - AC: matches Property 5 exactly
  - Verify: see 4.9
  - Mode: simulated
  - _Requirements: 39_

- [ ] 4.9* Property test — self-correction within an utterance keeps only the final value
  - Layer: testing
  - Deps: 4.8
  - **Property 5: Self-correction within an utterance keeps only the final value**
  - **Validates: Requirements 39**
  - Verify: property-based test, minimum 100 iterations, tagged `Feature: avelo, Property 5: Self-correction within an utterance keeps only the final value`
  - Mode: simulated

- [ ] 4.10 Implement relative-date resolution against `America/New_York`
  - Layer: domain-logic
  - Deps: 4.4
  - I/O: a transcript phrase (e.g. "next Tuesday") + `nowISO` in → a concrete ISO date in `patch`, echoed back as `resolvedRelativeDate` out
  - UX: the resolved calendar date is displayed back to the caregiver for confirmation
  - Errors: unresolvable relative phrases are treated as no match (field omitted, not guessed)
  - AC: resolution is always relative to `nowISO` interpreted in `America/New_York`
  - Verify: see 4.11
  - Mode: simulated
  - _Requirements: 41_

- [ ] 4.11* Unit test — relative date phrase resolves and is echoed back
  - Layer: testing
  - Deps: 4.10
  - Verify: unit test with a fixed `nowISO` asserting "next Tuesday" resolves to the correct concrete date and that date is present in `resolvedRelativeDate`
  - _Requirements: 41_

- [ ] 4.12 Implement `editVersion`-based stale-response rebase logic in `FieldMergeEngine`
  - Layer: domain-logic
  - Deps: 4.1, 1.3
  - I/O: a patch captured at `formEditVersion` arriving after the live draft's `editVersion` has advanced, in → a per-field rebase that applies the patch only to fields not themselves edited since `formEditVersion`, with per-field `rejectedStale` reporting, out
  - UX: an older, delayed AI response never overwrites a newer edit
  - Errors: fields edited since `formEditVersion` are left as-is and the stale sub-change is dropped, not the whole patch
  - AC: matches Property 6 exactly
  - Verify: see 4.13
  - Mode: real
  - _Requirements: 44_

- [ ] 4.13* Property test — stale responses never regress newer edits
  - Layer: testing
  - Deps: 4.12
  - **Property 6: Stale responses never regress newer edits**
  - **Validates: Requirements 44**
  - Verify: property-based test, minimum 100 iterations, tagged `Feature: avelo, Property 6: Stale responses never regress newer edits`
  - Mode: real

- [ ] 4.14 Implement undo-last-voice-patch (per-field prior-value tracking in `BookingStore`)
  - Layer: backend
  - Deps: 4.12, 1.3
  - I/O: the field values immediately prior to the most recent voice-sourced patch, plus the `editVersion` at that point, in → a restore of exactly those untouched-since fields out
  - UX: "Undo last voice update" recovers from a misheard instruction without redoing manual edits made afterward
  - Errors: a field edited (manually or by a newer voice patch) since the tracked voice patch is left untouched by undo
  - AC: matches Property 7 exactly
  - Verify: see 4.15
  - Mode: real
  - _Requirements: 47_

- [ ] 4.15* Property test — undo-last-voice-patch reverts only untouched fields
  - Layer: testing
  - Deps: 4.14
  - **Property 7: Undo-last-voice-patch reverts only untouched fields**
  - **Validates: Requirements 47**
  - Verify: property-based test, minimum 100 iterations, tagged `Feature: avelo, Property 7: Undo-last-voice-patch reverts only untouched fields`
  - Mode: real

- [ ] 4.16 Implement `POST /api/voice/extract`
  - Layer: backend
  - Deps: 4.4, 4.6, 4.8, 4.10, 4.12, 1.2
  - I/O: `VoiceExtractRequest` (`transcript`, `currentFormSnapshot`, `nowISO`, `formEditVersion`) in → `VoiceExtractResponse` (`patch`, `resolvedLeg?`, `clarificationNeeded?`, `resolvedRelativeDate?`, `confidence`, `source`) out
  - UX: selects the deterministic-fallback adapter automatically when `AI_EXTRACTION_PROVIDER` is unset; always tags the response with the correct `source`
  - Errors: a fixed timeout (e.g. 8s) on any real-provider call returns `ai-timeout` handling upstream (4.21); malformed output never reaches `FieldMergeEngine` (validated server-side first, see 4.17); request-shape failure → `400 VALIDATION_FAILED`
  - AC: no secret ever present in the request/response payload sent to the browser
  - Verify: integration test asserting `source: 'deterministic-fallback'` with no env vars configured
  - Mode: pluggable (simulated/deterministic-fallback by default; real LLM adapter optional, server-side only — Requirements 49, 99)
  - _Requirements: 29, 49, 50, 95, 99_

- [ ] 4.17* Property test — extractor output is schema-validated before merge, no partial pass-through
  - Layer: testing
  - Deps: 4.16
  - **Property 17: Extractor output is schema-validated before merge, with no partial pass-through**
  - **Validates: Requirements 95**
  - Verify: property-based test, minimum 100 iterations, tagged `Feature: avelo, Property 17: Extractor output is schema-validated before merge, with no partial pass-through`, including malformed/fuzzed raw outputs
  - Mode: real

- [ ] 4.18 Build `VoiceCaptureControl` (mic button + browser `SpeechRecognition` lifecycle + concurrency guard)
  - Layer: frontend
  - Deps: 1.6, 4.16
  - I/O: user click + recognition events in → transcript text + capture state (`listening`/`transcribing`/`updating`) out, calling `POST /api/voice/extract` and applying the result via `FieldMergeEngine`
  - UX: visible listening state on tap; repeated clicks never start a second concurrent recording/extraction
  - Errors: covered in detail in 4.21
  - Interactive: **mic button** — label "Start speaking" / "Stop" (toggles by state), icon-only with accessible name; enabled whenever no capture/extraction is already in flight, disabled (not hidden) while one is in flight; action starts/stops `SpeechRecognition` and, on a final transcript, calls `POST /api/voice/extract`; loading: `listening` → `transcribing` → `updating` visual states in sequence; success feedback: form fields update with a brief highlight (wired in 4.23) and the update is summarized; failure feedback: see 4.21's per-case handling; next state: returns to idle, ready for another tap
  - AC: matches Property 8 exactly
  - Verify: see 4.19
  - Mode: pluggable (real browser `SpeechRecognition` is actually used; extraction behind it is pluggable per 4.16)
  - _Requirements: 28, 29, 45, 46_

- [ ] 4.19* Property test — concurrent mic activation never starts a second capture
  - Layer: testing
  - Deps: 4.18
  - **Property 8: Concurrent mic activation never starts a second capture**
  - **Validates: Requirements 45**
  - Verify: property-based test, minimum 100 iterations, tagged `Feature: avelo, Property 8: Concurrent mic activation never starts a second capture`, simulating rapid repeated click events
  - Mode: real

- [ ] 4.20 Build the unsupported-browser / typed-natural-language fallback input (sub-component used by `VoiceCaptureControl`)
  - Layer: frontend
  - Deps: 4.16
  - I/O: typed free text in → the same `POST /api/voice/extract` call as voice, out
  - UX: when `'SpeechRecognition' in window || 'webkitSpeechRecognition' in window` is false, this labeled text input replaces the mic button as the primary input, not as a secondary option
  - Errors: empty submission is a no-op, not an error
  - Interactive: **"Describe your trip" text input + submit button** — label "Describe your trip in your own words"; submit button enabled only when the text field is non-empty; action calls `POST /api/voice/extract` with the typed text as `transcript`; loading: busy/disabled state during the in-flight request; success feedback: same field-update + highlight + summary as voice; failure feedback: same per-case handling as 4.21; next state: input clears on success, retained on failure
  - AC: identical extraction pipeline for typed and spoken input (Requirement 10)
  - Verify: unit test asserting feature-detection correctly swaps the mic button for this input
  - Mode: real
  - _Requirements: 10, 48_

- [ ] 4.21 Implement voice error/loading state handling
  - Layer: frontend
  - Deps: 4.18, 4.20
  - I/O: recognition/extraction lifecycle events in → one of `permission-denied`, `unsupported-browser`, `no-speech-detected`, `recording-failure`, `transcription-failure`, `ai-timeout`, `invalid-extraction` out, each rendered with a plain-English message
  - UX: every failure state leaves the form exactly as it was and always offers at least one of retry, manual entry, or typed-text input
  - Errors: this task is the error handling itself — each of the seven cases above must be individually reachable and individually tested (see 4.22)
  - AC: no raw stack trace or technical code ever shown to the caregiver
  - Verify: see 4.22
  - Mode: real
  - _Requirements: 36, 48_

- [ ] 4.22* Unit tests — each voice failure state leaves the form unchanged and offers a fallback
  - Layer: testing
  - Deps: 4.21
  - Verify: one unit test per state (`permission-denied`, `unsupported-browser`, `no-speech-detected`, `recording-failure`, `transcription-failure`, `ai-timeout`, `invalid-extraction`) asserting the draft is byte-identical before/after and at least one fallback action is offered
  - _Requirements: 36, 48_

- [ ] 4.23 Build `TranscriptPanel` + `FieldChangeHighlighter`
  - Layer: frontend
  - Deps: 4.18
  - I/O: transcript + patch summary in → the most recent transcript, a concise plain-English update summary, and a brief visual highlight on the fields the latest patch changed, out
  - UX: caregiver can confirm Avelo understood them correctly; ARIA live announcements accompany `listening`/`transcribing`/`updating` transitions and the summary
  - Errors: n/a
  - AC: highlight targets exactly `appliedFields` from the latest `MergeResult`, no more and no fewer
  - Verify: unit test asserting highlighted fields match `appliedFields`
  - Mode: real
  - _Requirements: 46_

- [ ] 4.24* End-to-end journey test — voice follow-up correction and ambiguity clarification
  - Layer: testing
  - Deps: 4.14, 4.18, 4.6, 4.23
  - Verify: e2e test (AC-VOICE-01) pre-filling a hospital name and time, then speaking/typing a follow-up mentioning only a different hospital name and time, asserting only those two fields changed; a second e2e test (AC-VOICE-02) sending an ambiguous leg/field phrase, asserting a focused clarifying question appears and all prior data is unchanged
  - Mode: simulated
  - _Requirements: 106, 107_

- [ ] 4.25 Checkpoint — voice extraction verified
  - Ensure all Slice 4 tests pass; ask the user if questions arise before starting Slice 5.

### 5. Special-request price revision

- [ ] 5.1 Extend `MatchingSimulator` with the revised-price candidate outcome and reason
  - Layer: domain-logic
  - Deps: 3.4
  - I/O: a scenario fixture signaling a price difference in → `accepted-revised-price` outcome with a concrete `{ difference, reason }` out
  - UX: none directly (consumed by 5.2/5.5)
  - Errors: n/a
  - AC: reason strings are concrete and specific (e.g. "additional assistance for medical equipment"), never vague
  - Verify: unit test asserting a known fixture produces the documented `+$15` / reason pair
  - Mode: simulated
  - _Requirements: 64_

- [ ] 5.2 Implement the `special-request-revision` demo scenario fixture in `DemoScenarioRunner`
  - Layer: backend
  - Deps: 3.7, 5.1
  - I/O: scenario id in → the fixed step sequence for caregiver "Linda Ortiz" / passenger "Marco Ortiz", `can-transfer`, special request "needs help carrying an oxygen tank": `Searching` → `CandidateFound` → `ProviderProposedRevision` (+$15, documented reason) out
  - UX: demo exposes both the accept-new-price path (→ `Confirmed`) and the find-another path (→ `Searching` → same candidate re-offered at original price, for repeatability)
  - Errors: deterministic, no randomness
  - AC: matches the `special-request-revision` fixture exactly as documented in design.md
  - Verify: unit test running the scenario twice down each branch and diffing sequences
  - Mode: simulated
  - _Requirements: 80, 84_

- [ ] 5.3 Implement `POST /api/booking/:id/accept-price`
  - Layer: backend
  - Deps: 3.8, 3.2
  - I/O: no body in → `BookingStatusResponse` with `status: 'Confirmed'` out
  - UX: accepting the new price confirms the booking
  - Errors: `409` if the booking is not currently `ProviderProposedRevision`
  - AC: calls `BookingStateMachine.transition` with `acceptNewPrice`, no direct state mutation elsewhere
  - Verify: integration test from `ProviderProposedRevision` → `Confirmed`, and a second asserting `409` from any other state
  - Mode: simulated
  - _Requirements: 65, 66_

- [ ] 5.4 Implement `POST /api/booking/:id/find-another`
  - Layer: backend
  - Deps: 3.8, 3.2
  - I/O: no body in → `BookingStatusResponse` with `status: 'Searching'` out
  - UX: choosing to find another option resumes the provider search
  - Errors: `409` if the booking is not currently `ProviderProposedRevision`
  - AC: calls `BookingStateMachine.transition` with `findAnother`
  - Verify: integration test from `ProviderProposedRevision` → `Searching`, and a second asserting `409` from any other state
  - Mode: simulated
  - _Requirements: 65, 66_

- [ ] 5.5 Build the "Price Update: Action Required" state UI on `BookingStatusView`
  - Layer: frontend
  - Deps: 3.11, 5.3, 5.4
  - I/O: `revisedEstimate` (`total`, `difference`, `reason`) in → original price, revised total, difference, and reason rendered, with confirmation withheld until an explicit choice out
  - UX: caregiver sees exactly what changed and why before any further progress
  - Errors: a failed accept/find-another call keeps the caregiver on this state with a plain-English error and retry
  - Interactive: **"Accept New Price and Confirm" button** — label "Accept New Price and Confirm"; enabled only while status is `ProviderProposedRevision`; action calls `POST /api/booking/:id/accept-price`; loading: busy/disabled during the in-flight request; success feedback: advances to "Booking Confirmed" / Arrangement Details; failure feedback: plain-English inline error, retry offered, state unchanged; next state: Arrangement Details (success) or remains on this state (failure). **"Find Another Option" button** — label "Find Another Option"; enabled only while status is `ProviderProposedRevision`; action calls `POST /api/booking/:id/find-another`; loading: busy/disabled during the in-flight request; success feedback: returns to "Finding a Provider" / "Searching for Another Provider"; failure feedback: plain-English inline error, retry offered; next state: "Searching for Another Provider" (success) or remains on this state (failure)
  - AC: matches AC-PRICE-01 exactly
  - Verify: see 5.6
  - Mode: real (UI) over simulated (pricing/matching) data
  - _Requirements: 64, 65, 66_

- [ ] 5.6* Property test — differing-price candidate requires explicit approval
  - Layer: testing
  - Deps: 5.1, 3.2
  - **Property 13: Same-price candidates confirm automatically; differing prices require explicit approval (differing-price branch; AC-PRICE-01)**
  - **Validates: Requirements 64, 65, 66**
  - Verify: property-based test, minimum 100 iterations, tagged `Feature: avelo, Property 13: Differing prices require explicit approval (differing-price branch)`
  - Mode: simulated

- [ ] 5.7* Property test — special requests remain attached through every subsequent view
  - Layer: testing
  - Deps: 3.8, 5.3, 5.4
  - **Property 16: Special requests remain attached through every subsequent view**
  - **Validates: Requirements 75**
  - Verify: property-based test, minimum 100 iterations, tagged `Feature: avelo, Property 16: Special requests remain attached through every subsequent view`, asserting `GET /api/booking/:id` returns identical `specialRequests` text across every state transition
  - Mode: simulated

- [ ] 5.8* End-to-end journey test — Special Request / Price Revision scenario
  - Layer: testing
  - Deps: 5.5, 5.2
  - Verify: e2e test driving the `special-request-revision` scenario through both the accept-new-price path (→ Booking Confirmed) and the find-another path (→ resumed search), asserting the special-request notice and the revision details are shown correctly on each
  - Mode: simulated
  - _Requirements: 80_

- [ ] 5.9 Checkpoint — price revision verified
  - Ensure all Slice 5 tests pass; ask the user if questions arise before starting Slice 6.

### 6. Replacement request

- [ ] 6.1 Exercise the replacement branch of `BookingStateMachine`'s transition table
  - Layer: domain-logic
  - Deps: 3.2, 3.6
  - I/O: a `Confirmed` booking + `requestReplacement` event (with reason) in → `ReplacementRequested` → `ReplacementSearching` → `ReplacementFound` → (`ReplacementConfirmed` or the replacement-variant `ProviderProposedRevision`) out, per the already-documented transition table
  - UX: none directly (consumed by 6.5)
  - Errors: `requestReplacement` is rejected unless the booking is currently `Confirmed`; a reason must be present
  - AC: the original `Confirmed` booking's provider/price remain the system of record and are shown on Arrangement Details until `ReplacementConfirmed` is reached
  - Verify: unit test walking the full replacement branch and asserting intermediate reads still show the original provider/price
  - Mode: simulated
  - _Requirements: 81_

- [ ] 6.2 Implement the `replacement` demo scenario fixture in `DemoScenarioRunner`
  - Layer: backend
  - Deps: 6.1, 3.7
  - I/O: scenario id in → a fixed step sequence starting from an already-`Confirmed` booking (reusing the `standard` fixture's data), through "Request a Different Arrangement" (reason "original provider's vehicle became unavailable") → `ReplacementSearching` (2s) → `ReplacementFound` with provider "Berkshire Accessible Transport" at the same price → `ReplacementConfirmed` out
  - UX: presenter can reliably repeat the replacement demo
  - Errors: deterministic, no randomness
  - AC: matches the `replacement` fixture exactly as documented in design.md
  - Verify: unit test running the scenario twice and diffing sequences
  - Mode: simulated
  - _Requirements: 81, 84_

- [ ] 6.3 Implement `POST /api/booking/:id/replace`
  - Layer: backend
  - Deps: 6.1, 3.9
  - I/O: `ReplaceRequestBody` (`reason`, required non-empty) in → `BookingStatusResponse` with `status: 'ReplacementSearching'` out
  - UX: none directly (consumed by 6.5)
  - Errors: `409` if the booking is not currently `Confirmed`; `400 VALIDATION_FAILED` if `reason` is empty
  - AC: calls `BookingStateMachine.transition` with `requestReplacement`
  - Verify: integration test from `Confirmed` → `ReplacementSearching`, and a second asserting `409`/`400` for invalid preconditions
  - Mode: simulated
  - _Requirements: 81_

- [ ] 6.4 Build `ReplacementRequestDialog`
  - Layer: frontend
  - Deps: 0.3, 3.12
  - I/O: open/close + reason text in → a submit event calling `POST /api/booking/:id/replace` out
  - UX: keyboard-operable modal with a focus trap while open and focus returned to the triggering element on close
  - Errors: empty reason blocks submission with an inline, accessible error
  - Interactive: **dialog's "Submit" button** — label "Request Replacement"; enabled only when the reason field is non-empty; action calls `POST /api/booking/:id/replace`; loading: busy/disabled during the in-flight request; success feedback: dialog closes, Booking Status enters the replacement sub-flow; failure feedback: inline error inside the dialog, dialog stays open, retry offered; next state: Booking Status replacement sub-flow (success) or dialog remains open (failure). **dialog's "Cancel" button** — label "Cancel"; always enabled; action closes the dialog with no request sent; no loading state; no failure case; next state: focus returns to the triggering element
  - AC: full keyboard operability and correct focus-trap/return-focus behavior (Requirement 90)
  - Verify: unit test asserting focus trap and focus-return behavior
  - Mode: real
  - _Requirements: 81, 90_

- [ ] 6.5 Wire "Request a Different Arrangement" on `ArrangementDetailsCard` + the replacement sub-flow on the Booking Status screen
  - Layer: frontend
  - Deps: 6.3, 6.4, 3.12, 3.11
  - I/O: confirmed booking in → `ReplacementRequestDialog` open event; on submission, the booking re-enters the replacement sub-flow while Arrangement Details continues to show the original `Confirmed` booking until the replacement finalizes, out
  - UX: no disruption to the originally confirmed arrangement's visibility during the replacement search
  - Errors: a failed replacement request leaves the original confirmed booking fully intact and visible
  - Interactive: **"Request a Different Arrangement" button** — label "Request a Different Arrangement"; enabled only while the booking is `Confirmed`; action opens `ReplacementRequestDialog`; no loading state itself (the dialog's own submit carries loading); no failure case for opening; next state: dialog open
  - AC: matches Requirement 81's "original Confirmed booking is retained" guarantee
  - Verify: unit test asserting Arrangement Details still shows the original provider/price while `ReplacementSearching`/`ReplacementFound` is in progress
  - Mode: real (UI) over simulated (replacement matching) data
  - _Requirements: 81_

- [ ] 6.6* End-to-end journey test — Replacement scenario
  - Layer: testing
  - Deps: 6.5, 6.2
  - Verify: e2e test starting from a `Confirmed` booking, opening `ReplacementRequestDialog`, submitting a reason, and asserting the sequence through `ReplacementSearching` → `ReplacementFound` → `ReplacementConfirmed` with "Berkshire Accessible Transport," while confirming the original confirmed arrangement remained visible throughout the search
  - Mode: simulated
  - _Requirements: 81_

- [ ] 6.7 Checkpoint — replacement flow verified
  - Ensure all Slice 6 tests pass; ask the user if questions arise before starting Slice 7.

### 7. Demo controls, polish, deployment, and submission materials

- [ ] 7.1 Build `DemoControlsPanel`
  - Layer: frontend
  - Deps: 0.3
  - I/O: scenario selection + reset click in → `/api/demo/*` calls out
  - UX: a discreet, collapsed drawer/tab reachable from every screen without navigating away; never competes visually with the caregiver-facing flow
  - Errors: n/a at this layer (endpoint errors reuse the generic `ApiError` display pattern)
  - Interactive: **"Load Example Data" button (per scenario)** — label e.g. "Load: Standard Arrangement"; always enabled; action calls `POST /api/demo/load-scenario`; loading: busy/disabled during the in-flight request; success feedback: form pre-filled with the scenario's fixture data; failure feedback: plain-English inline error, panel stays open; next state: panel remains open with the loaded draft visible. **scenario picker** — label "Demo scenario"; always enabled; action selects which scenario id subsequent "Load Example Data"/runner actions use; no loading state; no failure case; next state: n/a (selection only). **"Reset" button** — label "Reset"; always enabled; action calls `POST /api/demo/reset`; loading: busy/disabled during the in-flight request; success feedback: clean slate on the current screen (see 7.3/7.4); failure feedback: plain-English inline error, prior state retained; next state: fresh session, same screen
  - AC: opening the panel never navigates away from the current screen; panel is labeled as demo tooling, never mistaken for a caregiver-facing control
  - Verify: unit test asserting the panel overlays in place rather than navigating
  - Mode: real (UI) over simulated (scenario) data
  - _Requirements: 78_

- [ ] 7.2 Implement `POST /api/demo/load-scenario`
  - Layer: backend
  - Deps: 1.3, 3.7
  - I/O: `LoadScenarioRequest` (`scenario: 'standard' | 'special-request-revision' | 'replacement' | 'unavailable-provider'`) in → `LoadScenarioResponse` (`demoSessionId`, `form`) out
  - UX: none directly (consumed by 7.1)
  - Errors: unknown scenario id → `400 VALIDATION_FAILED`
  - AC: loading a scenario never silently changes mid-flight once loaded (Requirement 84)
  - Verify: integration test asserting each of the four scenario ids returns its documented fixture `form`
  - Mode: simulated
  - _Requirements: 78, 83, 84_

- [ ] 7.3 Implement `POST /api/demo/reset` + the epoch counter in `BookingStore`
  - Layer: backend
  - Deps: 1.3, 3.6
  - I/O: no body in → `ResetResponse` (`demoSessionId`, `epoch`) out; server increments the per-session epoch, clears draft/booking/validation errors/transcript/undo history/scheduled timers tied to the old epoch, and mints a fresh `demoSessionId`
  - UX: "Reset" reliably produces a clean slate every time
  - Errors: n/a
  - AC: matches Requirement 85's full clear-list exactly (form, booking, validation errors, transcript, in-progress recording/extraction state, scenario timers, relevant persisted demo state)
  - Verify: integration test asserting every listed piece of state is empty/absent immediately after reset
  - Mode: real
  - _Requirements: 85_

- [ ] 7.4 Implement epoch-tagging of async responses + stale-epoch discard logic
  - Layer: backend
  - Deps: 7.3
  - I/O: every async response (voice extraction, matching-delay callbacks) tagged with the epoch current when the request was issued, in → `BookingStore` comparing that epoch to the session's current epoch and silently discarding any stale-epoch response out
  - UX: a late response from a session that has since been reset never repopulates the new session
  - Errors: a discarded response produces no visible error (it is simply dropped, by design)
  - AC: matches Property 18 exactly (AC-DEMO-01)
  - Verify: see 7.5
  - Mode: real
  - _Requirements: 86_

- [ ] 7.5* Property test — reset invalidates the prior session irrevocably
  - Layer: testing
  - Deps: 7.4
  - **Property 18: Reset invalidates the prior session irrevocably (AC-DEMO-01)**
  - **Validates: Requirements 85, 86**
  - Verify: property-based test, minimum 100 iterations, tagged `Feature: avelo, Property 18: Reset invalidates the prior session irrevocably`
  - Mode: real

- [ ] 7.6 Implement the optional `unavailable-provider` demo scenario fixture + honest "Unable to Arrange" UI messaging
  - Layer: backend
  - Deps: 3.4, 3.7
  - I/O: scenario id in → the fixed step sequence for caregiver "Diane Marsh" / passenger "Harold Marsh", rural-long tier, wheelchair + 3 companions (exceeds fixture capacity): `Searching` (2s) → `Unmatched` → `UnableToArrange` out; plus the honest, non-guaranteeing "Unable to Arrange This Trip" copy on `BookingStatusView`
  - UX: caregiver sees an honest outcome, never an implication that a request is guaranteed fulfillable
  - Errors: n/a (this is itself the documented error/terminal path)
  - AC: never implies an arbitrary special request or trip is guaranteed to be honored
  - Verify: unit test asserting the exact "Unable to Arrange This Trip" label and non-guaranteeing copy render for this scenario
  - Mode: simulated
  - _Requirements: 76, 82_

- [ ] 7.7* Property test — demo scenarios are deterministic and idempotent across runs
  - Layer: testing
  - Deps: 3.7, 5.2, 6.2, 7.6
  - **Property 19: Demo scenarios are deterministic and idempotent across runs**
  - **Validates: Requirements 79, 80, 81, 82, 84**
  - Verify: property-based test, minimum 100 iterations, tagged `Feature: avelo, Property 19: Demo scenarios are deterministic and idempotent across runs`, running each of the four scenario ids twice from a freshly reset session and diffing sequences
  - Mode: simulated

- [ ] 7.8* End-to-end journey test — repeat-after-reset flow
  - Layer: testing
  - Deps: 7.3, 7.4, 3.14
  - Verify: e2e test running the Standard Arrangement journey to completion, triggering "Reset" from `DemoControlsPanel`, and asserting the form/booking/transcript/errors are all cleared and a late (artificially delayed) response from the pre-reset session never repopulates the new session
  - Mode: simulated
  - _Requirements: 112_

- [ ] 7.9 Accessibility polish pass across all screens and controls
  - Layer: frontend
  - Deps: 1.6, 1.13, 4.18, 3.11, 6.4
  - I/O: existing screens/components in → confirmed visible focus rings everywhere, 44x44px minimum touch targets, correct heading-focus on every screen transition (Landing→Form, Form→Review, Review→Status, Status→Details), and consistent `role="status"`/`aria-live="polite"` and `role="alert"`/`aria-live="assertive"` wiring across voice, validation, and booking-status changes, out
  - UX: full keyboard/screen-reader operability across the app
  - Errors: n/a
  - AC: every item in design.md's Accessibility section is present and verified by at least automated assertion
  - Verify: unit tests asserting focus-ring presence, touch-target sizes, and live-region roles across the listed screens; note per the project's content-safety guidance that full WCAG conformance ultimately requires manual testing with assistive technologies and is not fully certifiable by automated checks alone
  - Mode: real
  - _Requirements: 88, 90_

- [ ] 7.10 Visual design QA pass against palette/spacing/plain-English copy requirements
  - Layer: frontend
  - Deps: 0.2, 1.1
  - I/O: existing screens in → confirmed palette usage, spacing, large readable type, plain-English copy, responsive layout behavior at common mobile and desktop widths, and absence of dense dashboards/medical imagery/excessive animation/jargon/unsupported trust badges, out
  - UX: the experience reads as warm, calm, and approachable throughout, on both desktop and mobile
  - Errors: n/a
  - AC: every item in Requirements 87-89 and 91 is present and verified; every screen remains usable and legible at common mobile and desktop widths (Requirement 8)
  - Verify: manual visual review checklist at mobile and desktop widths plus a unit test scanning rendered copy for a documented jargon/abbreviation denylist
  - Mode: real
  - _Requirements: 8, 87, 88, 89, 91_

- [ ] 7.11 Add one Kiro hook for validation/quality + Kiro steering files
  - Layer: documentation
  - Deps: 1.4, 4.2
  - I/O: none in → (a) exactly one real, working Kiro hook with a documented trigger (e.g. on save of a domain module under `FieldMergeEngine`/`FormValidator`/`PricingEngine`/`BookingStateMachine`), action (run that module's property-based tests), and benefit (catches a merge/validation/pricing/state regression immediately); (b) steering files preserving English-only output, the defined product scope, the voice merge semantics, the visual style, and the testing principles, out
  - UX: none directly
  - Errors: n/a
  - AC: at most one hook is added, and it is genuine (it actually runs and actually catches a regression), never decorative or fabricated (Requirements 102, 103)
  - Verify: manually trigger the hook once and confirm it runs the intended test(s)
  - Mode: real
  - _Requirements: 100, 101, 102, 103_

- [ ] 7.12 Deployment configuration & documentation (not executed)
  - Layer: documentation
  - Deps: 0.1
  - I/O: none in → a documented deployment configuration (e.g. build/start commands, required/absent env vars) out, written but not executed
  - UX: none directly
  - Errors: n/a
  - AC: the application remains fully runnable locally with zero outbound network calls and no credentials configured; deployment steps are documented, not performed, in this phase (Requirement 105 — no publishing without explicit authorization)
  - Verify: manual review of the documented steps against the local `npm run build && npm start` path
  - Mode: documentation only, no deployment action taken
  - _Requirements: 92, 105_

- [ ] 7.13 Write submission documentation: README, env var example, testing/deployment instructions, real-vs-simulated explanation, product description, Kiro usage write-up, video script/shot list, submission checklist
  - Layer: documentation
  - Deps: 7.9, 7.10, 7.11, 7.12, 5.8, 6.6, 4.24, 3.14, 7.8
  - I/O: the completed implementation in → a single README (exact setup/run commands; `.env.example` containing no secrets; testing instructions; deployment instructions — documented, not executed; a real-vs-simulated functionality explanation naming which pieces are real code on simulated/fixture data versus pluggable-but-off real integrations, plus a note confirming the product requires no login/account creation and collects no real payment information; a product description; a Kiro usage write-up; a video script/shot list of approximately 2 minutes 50 seconds, under 3 minutes; and a submission checklist) out
  - UX: none directly (reviewer-facing documentation)
  - Errors: n/a
  - AC: no secret appears in the `.env.example`; no claim of test results that were not actually run (per the project's Testing Decisions); no publishing/uploading/submission is performed by this task — it only prepares the materials (Requirement 105)
  - Verify: manual review confirming every required README section listed in Requirement 104 is present
  - Mode: documentation only
  - _Requirements: 7, 100, 101, 104, 105_

- [ ] 7.14 Checkpoint — final verification before any submission
  - Ensure the full test suite (unit, property-based, and e2e) passes end to end; ask the user if questions arise, and do not publish, upload, or submit anything without the user's explicit authorization (Requirement 105).

---

## Acceptance Matrix — Section D

Every row maps one Given/When/Then-style acceptance criterion to the task(s) that implement it and the method used to verify it. The seven seeded criteria from `requirements.md` (AC-VOICE-01, AC-VOICE-02, AC-VALIDATION-01, AC-BOOKING-01, AC-PRICE-01, AC-TIME-01, AC-DEMO-01) are included first, followed by additional criteria of the same form covering every other major rule.

| AC ID | Given / When / Then | Related Task(s) | Verification Method |
|---|---|---|---|
| AC-VOICE-01 | Given a form with a hospital name and time already filled in, when the caregiver speaks/types a new instruction mentioning only a different hospital name and time, then only those two fields update and every other field remains unchanged. | 4.1, 4.2, 4.4, 4.24 | Property-based test (Property 1) + e2e journey test |
| AC-VOICE-02 | Given a form with existing data, when voice input is ambiguous about leg/field, then Avelo asks a focused English clarifying question and preserves all unrelated data. | 4.6, 4.7, 4.24 | Property-based test (Property 4) + e2e journey test |
| AC-VOICE-03 | Given a transcript with a mid-utterance self-correction for one field, when extraction runs, then only the final stated value is applied. | 4.8, 4.9 | Property-based test (Property 5) |
| AC-VOICE-04 | Given a transcript expressing explicit uncertainty ("three or four, not sure"), when extraction runs, then the field is never converted to a definite value and a clarifying question is produced instead. | 4.6, 4.7 | Property-based test (Property 4) |
| AC-VOICE-05 | Given any voice/typed input, when extraction and merge run, then the booking-submission action is never invoked as a side effect. | 4.1, 4.16 | Unit test / code review (no reference to submission in the merge pipeline) |
| AC-VOICE-06 | Given two patches applied with increasing `editVersion`, when a lower-versioned response arrives late, then it never overwrites a field already touched by a higher-versioned edit. | 4.12, 4.13 | Property-based test (Property 6) |
| AC-VOICE-07 | Given repeated rapid mic-button clicks, when evaluated at any point in time, then at most one capture/extraction session is active. | 4.18, 4.19 | Property-based test (Property 8) |
| AC-VOICE-08 | Given a voice patch followed by zero or more later edits, when "undo last voice update" is invoked, then only the fields the voice patch changed and left untouched since are restored. | 4.14, 4.15 | Property-based test (Property 7) |
| AC-VOICE-09 | Given a relative-date phrase and a known `nowISO`, when extraction runs, then the resolved concrete ISO date is echoed back as `resolvedRelativeDate` for caregiver confirmation. | 4.10, 4.11 | Unit test |
| AC-VOICE-10 | Given microphone permission is denied, when the caregiver taps the mic, then the form is unchanged and a manual/typed-text fallback is offered. | 4.21, 4.22 | Unit test |
| AC-VOICE-11 | Given an unsupported browser, when `VoiceCaptureControl` mounts, then the typed-natural-language input is shown as the primary input with no mic button. | 4.20, 4.22 | Unit test |
| AC-VOICE-12 | Given recognition ends with no speech detected, when that occurs, then the form is unchanged and a retry is offered. | 4.21, 4.22 | Unit test |
| AC-VOICE-13 | Given a `SpeechRecognition` API error during capture, when that occurs, then the form is unchanged and retry/manual-entry is offered. | 4.21, 4.22 | Unit test |
| AC-VOICE-14 | Given an empty or garbled transcript, when extraction is attempted, then the form is unchanged and a retry is offered. | 4.21, 4.22 | Unit test |
| AC-VOICE-15 | Given an extraction request exceeds the fixed timeout, when that occurs, then the form is unchanged and retry/manual-entry is offered. | 4.16, 4.21, 4.22 | Unit test |
| AC-VOICE-16 | Given a raw extractor response fails schema validation, when that occurs, then the form is unchanged, no partial patch is applied, and retry/manual-entry is offered. | 4.16, 4.17, 4.21, 4.22 | Property-based test (Property 17) + unit test |
| AC-VALIDATION-01 | Given a booking form with one or more required fields missing or invalid, when the caregiver attempts to submit, then Avelo blocks submission, shows descriptive English errors with an accessible error summary, and focuses the first invalid field. | 1.4, 1.5, 1.12, 1.13 | Property-based test (Property 9) + unit test of focus behavior |
| AC-VALIDATION-02 | Given a field with a validation error, when the caregiver fixes that field, then the error disappears and no other field's value or error state changes. | 1.12, 1.14 | Unit test |
| AC-VALIDATION-03 | Given any invalid field, when it is rendered, then the error is indicated by icon and text together, never color alone. | 1.12, 7.9 | Unit test + manual accessibility review (full WCAG conformance requires manual AT testing) |
| AC-VALIDATION-04 | Given validation errors remain on the form, when the caregiver attempts to use the mic or edit manually, then both remain fully available. | 1.12, 4.18 | Unit test |
| AC-VALIDATION-05 | Given the same field data entered manually vs. via a voice/typed patch, when `FormValidator` runs, then it reports identical errors either way. | 1.4, 4.16 | Property-based test (Property 9) applied through both entry paths |
| AC-BOOKING-01 | Given a submitted arrangement request, when the simulated provider accepts at the originally displayed price, then the booking transitions directly to Booking Confirmed with no additional approval step. | 3.2, 3.3, 3.7, 3.13, 3.14 | Property-based test (Property 13, same-price branch) + e2e journey test |
| AC-BOOKING-02 | Given a booking in `CandidateFound`, when read at that moment, then it is never treated or displayed as equivalent to a confirmed booking. | 3.2, 3.3, 3.11 | Property-based test (Property 14) + unit test of status labels |
| AC-BOOKING-03 | Given a candidate provider fixture, when `MatchingSimulator` evaluates it against a booking request, then it is never accepted if it fails service area, wheelchair accommodation, or companion-capacity requirements for either leg. | 3.4, 3.5 | Property-based test (Property 15) |
| AC-BOOKING-04 | Given a booking submitted with a non-empty special request, when read at any later state, then the exact special-request text is still present. | 3.9, 5.7 | Property-based test (Property 16) |
| AC-BOOKING-05 | Given a request that cannot be matched, when the scenario resolves, then Avelo shows an honest "Unable to Arrange This Trip" state with no implication of guaranteed fulfillment. | 7.6 | Unit test (exact messaging string) |
| AC-BOOKING-06 | Given any booking and any event sequence, when `BookingStateMachine.transition` is invoked, then only documented transitions occur and a duplicate `requestArrangement` is rejected without state change. | 3.2, 3.3, 3.8 | Property-based test (Property 14) |
| AC-PRICE-01 | Given a submitted request with a displayed estimate, when the simulated provider responds with a different price, then Avelo shows the original price, revised total, difference, and a specific reason, and withholds confirmation until "Accept New Price and Confirm" or "Find Another Option" is chosen. | 5.3, 5.4, 5.5, 5.6, 5.8 | Property-based test (Property 13, differing-price branch) + e2e journey test |
| AC-PRICE-02 | Given a revised-price state, when the caregiver chooses "Accept New Price and Confirm" or "Find Another Option," then the booking confirms or resumes searching, respectively, with no third outcome. | 5.3, 5.4, 5.5, 5.8 | E2e journey test |
| AC-PRICE-03 | Given `requirements.specialRequests` is non-empty, when Estimate & Review renders, then the exact required notice string is shown verbatim. | 2.9, 2.10 | Unit test |
| AC-PRICE-04 | Given a special request is present, when the initial estimate is requested, then a price is still returned immediately, never deferred to a manual-quote step. | 2.6, 2.9 | Property-based test (Property 10) + unit test |
| AC-PRICE-05 | Given any point in the flow, when payment is discussed, then the caregiver is shown that no real payment is collected in this demo. | 2.8, 7.13 | Unit test / documentation review |
| AC-TIME-01 | Given a required arrival time and a route fixture with a travel duration and documented buffer, when the suggested pickup time is calculated, then it equals required arrival time minus travel duration minus buffer, with an explanation shown. | 2.4, 2.5, 2.6 | Property-based test (Property 11) |
| AC-TIME-02 | Given the suggested pickup time explanation text, when rendered, then it never describes the calculation as based on live traffic. | 2.8 | Unit test (string content review) |
| AC-TIME-03 | Given a held Estimate, when a pricing/time-relevant field is edited, then the held Estimate is marked stale and a fresh `/api/estimate` call is required before display. | 2.11, 2.12 | Property-based test (Property 12) |
| AC-TIME-04 | Given a calculated pickup time that would fall before `00:00` on the trip date, when calculated, then Avelo returns an explicit, actionable `OUT_OF_BOUNDS` error instead of silently shifting the date. | 2.4, 2.5, 2.6 | Property-based test (Property 11) + unit test of the error message text |
| AC-DEMO-01 | Given an in-progress or completed demo scenario, when "Reset" is triggered, then the form, booking, validation errors, transcript, recording/extraction state, scenario timers, and relevant persisted demo state are all cleared, and any late response from the prior session never repopulates the new session. | 7.3, 7.4, 7.5, 7.8 | Property-based test (Property 18) + e2e journey test |
| AC-DEMO-02 | Given the `standard` scenario is loaded, when run, then it reproduces the full Standard Arrangement path (wheelchair request, complete schedule, estimate, brief search, same-price acceptance, auto-confirmation). | 3.7, 3.14 | E2e journey test |
| AC-DEMO-03 | Given the `special-request-revision` scenario is loaded, when run, then it reproduces the estimate-with-notice, search, revised price with reason, accept-new-price path, and find-another path. | 5.2, 5.8 | E2e journey test |
| AC-DEMO-04 | Given the `replacement` scenario is loaded, when run, then it reproduces starting from a confirmed booking, a replacement request with reason, a replacement search, and the updated provider on success while the original booking remains visible until finalized. | 6.2, 6.6 | E2e journey test |
| AC-DEMO-05 | Given the optional `unavailable-provider` scenario is loaded, when run, then it reproduces an honest "unable to arrange" outcome. | 7.6 | Unit test / e2e journey test (optional scenario) |
| AC-DEMO-06 | Given any scenario id, when run twice from a freshly reset session, then both runs produce the identical ordered sequence of state transitions and fixture data, with no mid-flight change. | 3.7, 7.7 | Property-based test (Property 19) |
| AC-A11Y-01 | Given any screen transition, when it completes, then semantic landmarks, a correct heading hierarchy, and a focus move to the new screen's heading are present. | 0.3, 7.9 | Unit test (focus assertions) + manual accessibility review (full WCAG conformance requires manual AT testing) |
| AC-A11Y-02 | Given `ReplacementRequestDialog` or the price-revision modal is open, when operated by keyboard alone, then focus is trapped inside it and returned to the triggering element on close. | 6.4, 7.9 | Unit test + manual accessibility review |
| AC-A11Y-03 | Given any interactive element, when rendered, then it has a visible focus ring, a minimum 44x44px touch target, and sufficient contrast. | 0.2, 7.9, 7.10 | Unit/visual review + manual accessibility review |
| AC-A11Y-04 | Given a voice state change, validation error summary, or booking-status change, when it occurs, then the appropriate ARIA live region announces it. | 0.3, 1.13, 3.11, 4.18, 7.9 | Unit test (aria-live attribute assertions) + manual accessibility review |
| AC-A11Y-05 | Given any app-controlled copy, when rendered, then it is plain English with no jargon, dense dashboards, medical imagery, or unsupported trust badges. | 7.10 | Content review / unit test on copy strings |
| AC-SCOPE-01 | Given any screen showing provider or booking information, when rendered, then it clearly indicates the matching is simulated. | 3.11, 3.12, 7.1 | Unit test (label text presence) |
| AC-FORM-01 | Given outbound leg values and no explicit caregiver override, when the return leg is initialized or re-derived, then `return.originAddress`/`return.destinationAddress` default from the outbound leg, and once overridden, further outbound edits never revert the override. | 1.9, 1.10 | Property-based test (Property 20) |

---

## Notes

- Tasks marked with `*` are optional test tasks and are not implemented in an automated pass unless explicitly un-skipped; all non-test (unmarked) tasks are required.
- "Mode" on each task states plainly whether that piece of functionality is real working code operating on real logic, simulated/fixture-driven demo behavior (as scoped by `requirements.md`'s Solution and Out of Scope sections), or pluggable (a real integration point that defaults to a simulated fallback, per Requirements 49/50/99).
- Accessibility rows (AC-A11Y-01 through AC-A11Y-05) are verified here by automated assertions plus manual review; full WCAG conformance cannot be certified by automated checks alone and ultimately requires manual testing with assistive technologies, as noted in each relevant task and matrix row.
- Checkpoints (0.5, 1.15, 2.14, 3.15, 4.25, 5.9, 6.7, 7.14) gate progress between slices and are never skipped even though they carry no requirement reference.
- No task in Slice 7 (or anywhere else in this plan) performs an actual publish/upload/submission action; 7.12 and 7.13 produce documentation and configuration only, per Requirement 105.
- Property-based test tasks are placed immediately after the domain module they validate (not deferred to the end of a slice), so a regression is caught at the point of introduction, per the project's Testing Decisions.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["0.1"] },
    { "id": 1, "tasks": ["0.2", "0.4"] },
    { "id": 2, "tasks": ["0.3"] },
    { "id": 3, "tasks": ["1.1", "1.2"] },
    { "id": 4, "tasks": ["1.3", "1.4"] },
    { "id": 5, "tasks": ["1.5", "1.6"] },
    { "id": 6, "tasks": ["1.7", "1.8", "1.9"] },
    { "id": 7, "tasks": ["1.10", "1.11"] },
    { "id": 8, "tasks": ["1.12"] },
    { "id": 9, "tasks": ["1.13"] },
    { "id": 10, "tasks": ["1.14"] },
    { "id": 11, "tasks": ["2.1"] },
    { "id": 12, "tasks": ["2.2", "2.4"] },
    { "id": 13, "tasks": ["2.3", "2.5"] },
    { "id": 14, "tasks": ["2.6"] },
    { "id": 15, "tasks": ["2.7"] },
    { "id": 16, "tasks": ["2.8"] },
    { "id": 17, "tasks": ["2.9", "2.11"] },
    { "id": 18, "tasks": ["2.10", "2.12"] },
    { "id": 19, "tasks": ["2.13"] },
    { "id": 20, "tasks": ["3.1"] },
    { "id": 21, "tasks": ["3.2", "3.4"] },
    { "id": 22, "tasks": ["3.3", "3.5", "3.6"] },
    { "id": 23, "tasks": ["3.7"] },
    { "id": 24, "tasks": ["3.8", "3.9"] },
    { "id": 25, "tasks": ["3.10", "3.11"] },
    { "id": 26, "tasks": ["3.12", "3.13"] },
    { "id": 27, "tasks": ["3.14"] },
    { "id": 28, "tasks": ["4.1"] },
    { "id": 29, "tasks": ["4.2", "4.3", "4.4"] },
    { "id": 30, "tasks": ["4.5", "4.6", "4.12"] },
    { "id": 31, "tasks": ["4.7", "4.8", "4.13"] },
    { "id": 32, "tasks": ["4.9", "4.10", "4.14"] },
    { "id": 33, "tasks": ["4.11", "4.15", "4.16"] },
    { "id": 34, "tasks": ["4.17", "4.18", "4.20"] },
    { "id": 35, "tasks": ["4.19", "4.21"] },
    { "id": 36, "tasks": ["4.22", "4.23"] },
    { "id": 37, "tasks": ["4.24"] },
    { "id": 38, "tasks": ["5.1"] },
    { "id": 39, "tasks": ["5.2", "5.3", "5.4"] },
    { "id": 40, "tasks": ["5.5", "5.6", "5.7"] },
    { "id": 41, "tasks": ["5.8"] },
    { "id": 42, "tasks": ["6.1"] },
    { "id": 43, "tasks": ["6.2", "6.3"] },
    { "id": 44, "tasks": ["6.4"] },
    { "id": 45, "tasks": ["6.5"] },
    { "id": 46, "tasks": ["6.6"] },
    { "id": 47, "tasks": ["7.1"] },
    { "id": 48, "tasks": ["7.2", "7.3"] },
    { "id": 49, "tasks": ["7.4", "7.6"] },
    { "id": 50, "tasks": ["7.5", "7.7"] },
    { "id": 51, "tasks": ["7.8", "7.11", "7.12"] },
    { "id": 52, "tasks": ["7.9"] },
    { "id": 53, "tasks": ["7.10"] },
    { "id": 54, "tasks": ["7.13"] }
  ]
}
```


---

## Implementation Status (actual, recorded after building the application)

This section is the honest completion record for this implementation pass, written after running the actual
build/test commands (see `avelo/README.md` for exact commands and results). It does not alter the plan above; it
records what actually happened against it.

**Fully implemented and verified** (all non-test tasks in Slices 0-7; the application builds, type-checks, lints
clean, and is runnable via `npm run dev` / `npm run build && npm start`):

- Slice 0 (0.1-0.5): Next.js + TypeScript scaffold, design tokens, accessible base layout, Vitest + fast-check +
  Playwright test frameworks configured and running.
- Slice 1 (1.1-1.15): Landing, `BookingFormData`/`FormFieldPatch` types, `FormValidator`, the Booking Form page with
  all manual fields (Caregiver/Passenger, Outbound, Return with default-from-outbound derivation, Requirements),
  inline validation, `ValidationErrorSummary` with focus management.
- Slice 2 (2.1-2.14): route/pricing fixtures, `PricingEngine`, `PickupTimeCalculator`, `POST /api/estimate`,
  "Review Estimate" button, Estimate & Review page (price breakdown, special-request notice, no-payment
  reassurance), stale-estimate invalidation, "Edit" action.
- Slice 3 (3.1-3.15): `BookingStatus` union + 5-label mapping, `BookingStateMachine`, `MatchingSimulator`,
  `POST /api/booking/request` + `GET /api/booking/:id`, "Request Arrangement" button, Booking Status page,
  Arrangement Details page.
- Slice 4 (4.1-4.25): `FieldMergeEngine` (mentioned-only update, explicit-clear, stale-patch rebase),
  `DeterministicFallbackExtractor` (leg resolution, uncertainty detection, self-correction, relative-date
  resolution), `POST /api/voice/extract`, `VoiceCaptureControl` (listening/transcribing/updating states, mic
  concurrency guard, typed-NL fallback, transcript + change-highlight + summary), full voice error-state handling.
- Slice 5 (5.1-5.9): revised-price `MatchingSimulator`/scenario logic, `POST /api/booking/:id/accept-price` and
  `/find-another`, the "Price Update: Action Required" UI with both actions.
- Slice 6 (6.1-6.7): replacement branch of the state machine, `POST /api/booking/:id/replace`,
  `ReplacementRequestDialog` (focus trap, focus return), "Request a Different Arrangement" wiring that keeps the
  original confirmed arrangement visible during the replacement search.
- Slice 7 (7.1-7.4, 7.6, 7.11-7.14): `DemoControlsPanel`, `POST /api/demo/load-scenario` and `/reset`, the optional
  Unavailable-Provider scenario, one real Kiro hook (`domain-tests-on-save`), 5 steering files, README,
  `.env.example`, `KIRO_USAGE.md`, `VIDEO_SCRIPT.md`, `SUBMISSION_CHECKLIST.md`.

**Documented deviations from the literal task text** (behavior/contracts preserved; only the stated mechanism
changed -- see `avelo/README.md`'s "documented deviation" note and `src/server/bookingStore.ts`'s header comment):

- Tasks 1.3 / 3.6: the pre-submission form draft lives in client-side React state
  (`BookingProvider.tsx`) rather than a server-side per-session store, because `FormValidator`/`FieldMergeEngine`
  are isomorphic and run identically either way. `BookingStore` (server-side) holds booking + timer state only.
- Task 7.3/7.4: there is no `demoSessionId`/global epoch counter; instead each booking is deleted outright on
  reset (cancelling its timers), and the client keeps a local `requestEpochRef` to discard in-flight responses
  after a reset. The observable guarantee (a late response can never repopulate a post-reset session) holds and
  is covered by the e2e repeat-after-reset test.
- Task 5.2 / requirement 14: added a `SearchingAgain` internal status (distinct from the initial `Searching`) so
  "Find Another Option" maps to the caregiver-facing label "Searching for Another Provider" rather than reusing
  "Finding a Provider" -- this was found and fixed via the e2e test run, not merely assumed correct.
- Tasks 2.9/4.23: `SpecialRequestNotice`/`TranscriptPanel`/`FieldChangeHighlighter` are implemented as logic inlined
  into `ReviewPage`/`VoiceCaptureControl` plus the `useHighlightedFields` hook, rather than as separately-exported
  components, for the same responsibilities.

**Property-based test coverage actually executed** (fast-check, `npm run test`, 57/57 passed): Property 1
(mentioned-only update), Property 2 (latest-wins), Property 6 (stale rebase), Property 9 (validator flags exactly
invalid fields), Property 10 (pricing deterministic/additive), Property 11 (pickup-time formula / bounds error),
Property 14 (only documented transitions reachable), Property 15 (matching never violates a hard requirement),
Property 20 (return-leg defaults until overridden).

**Not implemented as dedicated property-based tests** (covered instead by targeted unit tests and/or the e2e
journey suite, or not covered by an automated test at all -- stated plainly rather than claimed): Property 3 (leg
resolution) and Property 4 (uncertainty/ambiguity) are covered by unit tests in
`voiceExtractionAdapter.test.ts`, not fast-check properties. Property 5 (self-correction) likewise unit-tested.
Property 7 (undo-last-voice-patch) is unit-tested in `bookingDraftReducer.test.ts`. Property 8 (mic concurrency
guard), Property 12 (stale-estimate invalidation on relevant edits), Property 13 (differing-price branch as a
dedicated property vs. the unit test that exists), Property 16 (special requests remain attached), Property 17
(extractor output schema validation under fuzzing), Property 18 (reset invalidates prior session), and Property 19
(scenario determinism/idempotence across runs) do not have a dedicated fast-check test in this submission. Tasks
4.11, 4.22, 4.24, 5.7, 7.5, 7.7, 7.9 (as a standalone automated accessibility-assertion task beyond what's inline in
the UI), and 7.10 (as a standalone jargon-scan unit test) were not completed as separately-written test
artifacts. The underlying application behavior they would have verified is exercised indirectly by the e2e suite
and by manual review, but that is not the same as an executed, dedicated automated test for each -- stated here
plainly rather than implied.

**End-to-end (Playwright) tests actually executed** (`npm run test:e2e`, 5/5 passed): Standard Arrangement
(AC-BOOKING-01, AC-DEMO-02); Special Request/Price Revision via the accept-new-price path (AC-PRICE-01/02,
AC-DEMO-03); Special Request/Price Revision via the find-another path; Replacement (AC-DEMO-04); and
repeat-after-reset (AC-DEMO-01). These drive the manual-entry path, not real microphone audio (see README); voice
merge/extraction correctness is verified at the unit level instead.


## Changes after manual testing (recorded after the fact)

These changes came from the project owner testing the running app. Each was made in the code first and then
recorded here, so the spec stays the source of truth.

- [x] V.1 Voice capture keeps listening through pauses (frontend, real)
  - Cause: `SpeechRecognition` ran with `continuous = false`, so Chrome ended the recording at the first pause.
  - Fix: continuous mode with interim results shown live. Recording ends on **Stop**, after 4 s of silence once
    speech was heard, or after 60 s. The full transcript is sent only after recording ends.
  - Verify: manual test with a microphone (owner); concurrency guard and error mapping reviewed in code.
- [x] V.2 Extractor understands real browser transcripts and resolves the trip leg correctly (domain logic, real code on fallback rules)
  - Cause: patterns required "4 PM" and capitalized names. Chrome produces "4 p.m." and lowercase text. "Pick her
    up from the hospital at 4 PM" set the arrival time; the unit test encoded that wrong expectation (AC-VOICE-01).
  - Fix: transcript normalization; per-time leg resolution from nearby wording; "pick up FROM <place>" means the
    ride home; uncertain or ambiguous times trigger a focused question; dates, addresses, names, phone,
    companions, mobility, and special requests extracted. Server validates every patch (`validateExtractedPatch`,
    Property 17) before returning it.
  - Verify: `voiceExtractionAdapter.test.ts` (21 tests, including the exact demo-video sentences).
- [x] V.3 Stale-patch check off by one (domain logic, real)
  - Cause: a field last edited exactly at the capture's base version was treated as stale.
  - Fix: `lastTouchedAt > patchEditVersion`. Verify: unit test "a field last edited before capture started is not
    treated as stale".
- [x] H.1 Naming a hospital fills in its address (domain logic + frontend, real code on fictional data)
  - Requirement (owner): when the caregiver names the hospital, the correct address should be entered automatically.
  - Consistency with Requirement 27 (no real address service, never claim "verified"): implemented as a fictional
    demo directory (`src/domain/hospitalDirectory.ts`), labeled as demo data in the form's help text.
  - Rules (shared by manual and voice input, in `BookingProvider`'s `applyDerivedRules`): a known hospital fills
    the destination address unless the caregiver typed one; switching hospitals replaces an auto-filled address;
    switching to an unknown hospital clears an auto-filled address so a wrong one is never left behind; the return
    pickup address follows; the estimate is marked stale; voice undo reverts the name and the address together. A
    "Use the address on file" button appears when a typed address differs from the directory.
  - Verify: `hospitalAutofill.test.ts` (8 tests) and the e2e test "Voice/text input: naming a hospital fills its
    address".
- [x] S.1 Submission readiness (documentation/integration)
  - Root README, `PROJECT_DESCRIPTION.md`, rewritten `KIRO_USAGE.md` (removed claims that were not true),
    `VIDEO_SCRIPT.md`, `SUBMISSION_CHECKLIST.md` mapped to the official rules, `render.yaml`, Node >= 20.9 engines
    field, default Next.js/Vercel assets replaced with an Avelo icon, hook command made PowerShell 5.1-safe, e2e
    suite moved to the production build.
