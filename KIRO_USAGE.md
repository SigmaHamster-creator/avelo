# How Kiro was used to build Avelo

This is a factual account. Where something was not used, or was added late, it says so.

## Kiro tools used

| Tool | Used? | How |
|---|---|---|
| **Kiro IDE** (agent chat, Autopilot mode) | Yes, for everything | Planning, spec authoring, all implementation, testing, and the fixes found during manual testing. |
| Kiro spec workflow ("fast task" spec) | Yes | Produced `.kiro/specs/avelo/` before any app code existed (details below). |
| Kiro sub-agents | Yes | The spec was produced by a dedicated spec sub-agent in separate phases (clarify, requirements, design, tasks, review), keeping the long planning work out of the main implementation context. |
| Steering | Yes | Five files in `.kiro/steering/` (details below). |
| Agent hooks | Yes, one | `.kiro/hooks/domain-tests-on-save.json` (details below). |
| Kiro CLI, Web, Crew | No | Everything ran inside the IDE, so no comparison between tools is offered. _(If team members used these, add it here.)_ |
| MCP servers | No | No external tool was needed; the demo deliberately uses no live services. |
| Kiro Powers | No | None were installed. |

## Spec-driven development

**How the spec was structured.** The product brief was long and precise (voice merge rules, pricing behavior,
screens, demo scenarios). Instead of coding from it directly, the spec workflow turned it into three linked
documents, each validated for format before the next began:

1. **`requirements.md`** (112 numbered user stories). Problem, solution, user stories grouped by area (screens,
   form data, voice, validation, pricing, pickup time, booking state, demo scenarios, accessibility,
   architecture, submission), implementation and testing decisions, out-of-scope list, and the seven required
   acceptance criteria (AC-VOICE-01, AC-VALIDATION-01, AC-BOOKING-01, and so on) as traceable stories.
2. **`design.md`** (20 numbered correctness properties). Architecture, domain vocabulary, the exact form schema,
   API contracts for every endpoint, the precise field-merge rules, the pricing and pickup-time fixture tables
   with worked examples, the full booking state machine and its transition table, error states, reset behavior,
   accessibility, and demo fixtures.
3. **`tasks.md`** (104 tasks across 8 slices, 49-row acceptance matrix). Each task lists its layer,
   dependencies, inputs and outputs, user-visible behavior, edge cases, acceptance criteria, verification method,
   and whether it is real or simulated. Every button lists its label, enabled condition, loading state, success
   and failure feedback, and next screen. The acceptance matrix maps each Given/When/Then criterion to tasks and a
   verification method.

A final review pass cross-checked the three files and found six requirements with no task (responsive layout,
progress indicator, a "no real payment" notice, and others). They were added before implementation began. That
is the kind of gap that usually only surfaces in a demo.

**How it shaped the code.** The module names in the design became the file names: `FormValidator`,
`FieldMergeEngine`, `PricingEngine`, `PickupTimeCalculator`, `BookingStateMachine`, `MatchingSimulator`,
`VoiceExtractionAdapter`, `BookingStore`. The transition table in `design.md` was copied into
`src/domain/bookingStateMachine.ts`. The worked example "10:00 arrival, 60-minute route, 30-minute buffer gives
an 8:30 pickup" became a test.

**Compared with vibe coding.** The spec made the hard part explicit before any code existed: the voice-update
rule ("the latest input wins for every field it mentions; unmentioned fields are preserved") and the rule that a
candidate match is never a confirmed booking. Those rules show up as one shared module and a dedicated
`CandidateFound` state, rather than being re-decided in every component.

**Where it fell short.** The spec did not prevent everything:

- Manual testing found that the microphone stopped at the first pause (single-utterance mode), and that the
  extractor did not understand Chrome's real transcript format ("4 p.m.", lowercase names).
- One unit test encoded the wrong expectation for AC-VOICE-01: "pick her up from the hospital at 4 PM" was
  setting the arrival time instead of the return pickup time, and the test passed anyway. The fix rewrote leg
  resolution and replaced the test with ones using real speech-style phrases.
- The design called for a server-side draft store with a session epoch. The build kept the draft in the browser
  instead (the shared modules run identically on both sides). This deviation is recorded in `tasks.md`.

`tasks.md` ends with an "Implementation Status" section listing what was built, every deviation from the plan,
and which tests were and were not written.

## Steering

Five steering files in `.kiro/steering/`, each with an explicit inclusion mode:

| File | Inclusion | Purpose |
|---|---|---|
| `product-scope.md` | always | Customer-facing only, simulated providers labeled as such, no emergency framing beyond one statement, fictional addresses never called "verified". |
| `english-only.md` | always | All copy, code, data, and docs in English. |
| `voice-merge-semantics.md` | fileMatch: voice/merge modules | The 11 voice rules (latest wins, omission preserves, uncertainty blocks a definite value, never auto-submit, and so on). |
| `visual-style.md` | fileMatch: `.tsx` UI files | Palette, touch targets, never color-only errors. |
| `testing-principles.md` | fileMatch: `*.test.ts` | Journey-first testing, property tests for the contracts, never claim an unrun test passed. |

**Honest timing.** The steering files were written after the first implementation pass, not before. They did not
shape that first pass. They did shape the later work: the voice rewrite, the hospital-address feature, and the
submission fixes. For example, `product-scope.md` is why the new hospital directory is labeled as fictional demo
data and never as a verified address.

**Strategy that mattered most.** Scoping steering with `fileMatch` keeps detailed rules (such as the voice merge
rules) out of unrelated work, while the two short `always` files guard the decisions that apply everywhere.

## Agent hook

`.kiro/hooks/domain-tests-on-save.json`:

- **Trigger:** `PostFileSave`, when the saved file matches `avelo/src/domain/*.ts`.
- **Action:** runs `npm --prefix avelo test -- src/domain/__tests__` (the domain test suite: 7 files, 57 tests).
- **Why:** the domain layer holds the correctness rules (merge, validation, pricing, pickup time, state machine,
  matching), so saving any of those files immediately re-checks them.

**Honest status.** The hook was created near the end of development, so it did not catch anything during the main
build. The first version used `cd avelo && ...`, which fails in Windows PowerShell 5.1. It was replaced with the
`npm --prefix` form, and that exact command was run manually from the workspace root and passed 57/57 tests. Its
benefit is ongoing protection for future changes, not a regression it has already caught.

## Property-based testing

`fast-check` is used where a rule should hold for every input, not just a few examples:

| Requirement | Property tested |
|---|---|
| Voice/manual merge (latest wins, unmentioned fields preserved) | Applying a patch changes exactly the mentioned fields and nothing else; the later of two edits wins; a late response never overwrites a newer edit. |
| Validation shared by manual and voice input | Companion count is flagged exactly when it falls outside 0-4. |
| Pricing | Deterministic, and total = outbound + return, for arbitrary addresses and mobility. |
| Suggested pickup time | Equals arrival minus travel minus buffer, or gives an explicit error, never a shifted date. |
| Booking state machine | A rejected event never changes the status; only documented transitions exist. |
| Matching | A provider is never accepted if it can't handle the wheelchair or the number of companions. |
| Return-leg defaults | The return addresses follow the outbound ones until the caregiver overrides them. |
| AI output safety | Arbitrary objects are either fully allowed as a form patch or rejected, never partly applied. |

**Did PBT catch something unit tests missed?** Not in this project, honestly. The property tests passed once the
code was written. Their value here was confidence across thousands of generated inputs, not a specific caught bug.
The real bugs (the voice leg error, the mic cut-off, an off-by-one in stale-response handling) were found by
manual testing and code review. The e2e suite also caught a missing "Searching for Another Provider" status. The
lesson recorded in the spec is that a unit test is only as good as its expected value.

## Results (actually run)

- `npm test`: **68/68 passed** (9 files)
- `npm run test:e2e`: **6/6 passed** (standard booking, price revision accept and decline, replacement, voice and
  hospital-address autofill, reset and repeat)
- `npm run build`, `tsc --noEmit`, `eslint`: clean
