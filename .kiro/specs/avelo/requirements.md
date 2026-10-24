# Requirements Document

## Introduction

Avelo ("Every journey, thoughtfully arranged.") is a customer-facing MVP that lets a caregiver in rural Massachusetts describe a non-emergency medical transportation trip — by form or by English voice — and immediately receive a round-trip price estimate, then simulates matching that trip with a suitable fictional provider through deterministic, repeatable demo scenarios. This document captures the problem, the solution, the full set of user stories drawn from the product brief (including the seven required Given/When/Then acceptance seeds), the settled implementation and testing decisions, what is explicitly out of scope, and further notes on assumptions and optional external dependencies.

## Problem Statement

Caregivers in rural Massachusetts who arrange non-emergency medical transportation for a mobility-limited passenger struggle to find a transportation provider that covers their location, accommodates the passenger's mobility needs, and supports a scheduled appointment with a return trip — without calling around to compare providers one by one. Rural service areas, wheelchair-accessible vehicle requirements, and the need to coordinate both an outbound and a return leg around a required arrival time make this process slow, fragmented, and stressful for the caregiver, who is typically already managing the passenger's medical appointment logistics.

## Solution

Avelo ("Every journey, thoughtfully arranged.") lets a caregiver describe a non-emergency medical transportation trip once — by form or by English voice — and immediately receive a round-trip price estimate. Avelo then simulates matching the trip with a suitable fictional provider: it confirms automatically when the estimated price holds, and asks for the caregiver's approval when the price changes. This is a customer-facing-only MVP (no dispatcher dashboard, driver app, or provider portal). Provider availability, matching, and acceptance are simulated through deterministic, repeatable demo scenarios: Standard Arrangement, Special Request / Price Revision, Replacement, and an optional Unavailable-Provider scenario. Avelo explicitly supports non-emergency coordination only; it performs no clinical triage and no emergency dispatch.

## Requirements

### User Stories

### Product Context & Scope

1. As a caregiver, I want to see the Avelo brand, tagline, and a short explanation of what the product does, so that I immediately understand this is a scheduled, non-emergency ride-arrangement tool for a loved one.
2. As a caregiver, I want a single clear "Schedule a Ride" call to action on the landing page, so that I can start the booking process without hunting for the right entry point.
3. As a caregiver, I want the landing page to state concisely that Avelo is for non-emergency transportation only, so that I do not mistake it for an emergency service.
4. As a caregiver, I want the entire product experience to be customer-facing only, with no dispatcher dashboard, driver app, or provider portal exposed to me, so that the MVP stays focused on the arrangement experience I actually need.
5. As a caregiver, I want provider availability, matching, and acceptance to be simulated through deterministic demo scenarios, so that I can reliably exercise and demonstrate the full booking flow without a real provider network existing yet.
6. As a caregiver, I want to book a single round trip (outbound plus return) per arrangement, scheduled in advance, so that I can plan a complete appointment-day transportation need in one request.
7. As a caregiver, I want to use Avelo without creating a login or providing real payment information, so that the demo experience stays low-friction and appropriate for an MVP.
8. As a caregiver, I want Avelo to work well on both desktop and mobile screens, so that I can arrange a ride from whatever device I have at hand.

### Screens

9. As a caregiver, I want a landing screen with the brand, tagline, supporting copy, and the "Schedule a Ride" CTA, so that I can orient myself and start booking in one place.
10. As a caregiver, I want a booking form screen that supports manual entry, microphone voice input, and optional typed natural-language input using the same extraction pipeline, so that I can fill in trip details in whichever way is easiest for me in the moment.
11. As a caregiver, I want the booking form to show inline validation and progress indication, so that I know what is still missing before I try to move forward.
12. As a caregiver, I want an estimate-and-review screen that shows passenger and caregiver info, outbound and return details, required arrival time, suggested pickup time, mobility and assistance needs, the price estimate with a breakdown, and a special-request pricing notice when relevant, so that I can confirm everything is correct before requesting an arrangement.
13. As a caregiver, I want an "Edit" action and a "Request Arrangement" action on the estimate-and-review screen, so that I can correct details or proceed with confidence.
14. As a caregiver, I want a booking status screen with distinct states — Finding a Provider, Price Update: Action Required, Booking Confirmed, Searching for Another Provider, and Unable to Arrange This Trip — so that I always know exactly where my request stands.
15. As a caregiver, I want an arrangement details screen showing the booking reference, the fictional provider, the vehicle and accessibility equipment, passenger and companion details, both legs with their times, the price and status, and a "Request a Different Arrangement" action, so that I have one place to review and act on a confirmed booking.
16. As a caregiver, I want every screen that shows provider or booking information to clearly indicate that the matching is simulated, so that I never mistake the demo for a real dispatch system.

### Form Data

17. As a caregiver, I want to enter my name and phone number, so that a provider (fictionally, in this demo) can identify and reach me.
18. As a caregiver, I want to enter the passenger's name, so that the arrangement is clearly tied to the person being transported.
19. As a caregiver, I want to enter the outbound pickup address, destination/hospital, destination address, trip date, and required arrival time, so that Avelo can determine when the passenger needs to be picked up.
20. As a caregiver, I want Avelo to calculate a suggested outbound pickup time for me, so that I do not have to do the arithmetic between travel time and the required arrival time myself.
21. As a caregiver, I want to set a fixed return pickup time, so that I can plan the return trip precisely instead of waiting for a generic "call when ready" pickup.
22. As a caregiver, I want the return origin to default to the outbound destination and the return destination to default to the outbound pickup address, while still being able to edit either, so that the common round-trip case requires minimal re-entry but unusual cases are still supported.
23. As a caregiver, I want to indicate whether the passenger can transfer to a vehicle seat or must remain in their wheelchair, the number of companions, and any additional assistance or special requests, so that the arrangement reflects the passenger's actual mobility needs.
24. As a caregiver, I want every form field to have a clear label and helper text, so that I understand exactly what information is being requested and why.
25. As a caregiver, I want the form to avoid asking for medical or demographic information beyond what is needed to arrange transportation, so that I am not burdened with irrelevant or sensitive data entry.
26. As a caregiver, I want both the outbound and return legs to be assumed to occur on the same trip date, so that the booking model matches the common same-day round-trip appointment case (documented assumption).
27. As a caregiver, I want Avelo to use fictional demo addresses and deterministic route fixtures rather than a real address-verification service, so that the demo works reliably without claiming address accuracy it cannot guarantee; Avelo will never claim an address is "verified" beyond a basic completeness check.

### Voice Input

28. As a caregiver, I want to tap a microphone button and see a visible listening state, so that I know when Avelo is capturing my speech.
29. As a caregiver, I want to speak in English and have my speech transcribed and then interpreted by an AI extractor that identifies relevant trip fields, so that I can fill out the form hands-free.
30. As a caregiver, I want only the fields I actually mentioned in my speech to be updated, so that unrelated information I already entered is never disturbed.
31. As a caregiver, I want to speak a follow-up correction such as "Pick up my grandmother from Pine Valley Hospital at 4 PM" after an earlier statement, and have only the hospital name and time update while everything else stays the same, so that I can refine my request naturally without restating the whole trip.
32. As a caregiver, I want the latest voice or manual input to win for any field it mentions, with no need to say "change" or "update," so that correcting a detail feels like normal conversation.
33. As a caregiver, I want Avelo to resolve which trip leg I am referring to from context — for example, a hospital pickup mentioned for the return leg should update the return pickup time, not the required arrival time — so that my corrections land on the correct part of the trip.
34. As a caregiver, I want Avelo to ask a focused, plain-English clarifying question when it cannot tell which leg or field I meant, while preserving all unrelated data, so that ambiguous input does not corrupt my booking.
35. As a caregiver, I want fields I did not mention to remain unchanged and never be erased just because I left them out, so that I never lose previously entered information through silence.
36. As a caregiver, I want an empty or failed voice extraction to leave my form exactly as it was, so that a bad recording never resets my progress.
37. As a caregiver, I want clearing a field to require an explicit deletion request or a manual clear action, so that a field is never wiped out by accident.
38. As a caregiver, I want the latest-update rule to apply consistently whether my most recent edit was by voice or by manual typing, so that the two input modes behave predictably together.
39. As a caregiver, I want a clear self-correction within a single utterance (for example, correcting myself mid-sentence) to result in only the final stated value being applied, so that Avelo understands natural speech patterns.
40. As a caregiver, I want explicit uncertainty in my speech, such as "three or four, not sure," to never be converted into a definite value, so that Avelo does not fabricate precision I did not provide.
41. As a caregiver, I want relative dates in my speech (like "next Tuesday") to be resolved using the current date and the America/New_York time zone, with the resolved calendar date displayed back to me, so that I can confirm Avelo understood the date correctly.
42. As a caregiver, I want Avelo to never invent a "home" address or an unspecified hospital name on my behalf, so that the form never contains fabricated information I did not provide.
43. As a caregiver, I want voice input to never auto-submit the booking, so that I always retain final control over when the arrangement request is sent.
44. As a caregiver, I want Avelo to prevent an older, delayed AI response from overwriting a newer edit I made in the meantime, so that stale results never clobber my latest input.
45. As a caregiver, I want repeated clicks on the microphone button to never trigger duplicate concurrent recordings or extractions, so that my form updates stay consistent and predictable.
46. As a caregiver, I want to see listening, transcribing, and updating states, the transcript of what I said, a brief highlight on the fields that changed, and a concise summary of the update, so that I can confirm Avelo understood me correctly.
47. As a caregiver, I want to undo the most recent voice-driven update without losing any manual edits I made afterward, so that I can recover from a misheard instruction without redoing other work.
48. As a caregiver, I want clear, specific handling for microphone permission denial, unsupported browsers, no speech detected, recording failures, transcription failures, AI timeouts, and invalid extraction responses, so that a technical hiccup never destroys my form data and I am always offered a retry, manual-entry, or text-input fallback.
49. As a caregiver, I want Avelo to use a real microphone capture, transcription, and AI extraction pipeline when valid credentials and platform support are available, configured through a server-side adapter and environment variables with no secrets ever reaching the browser, so that the voice feature can become fully functional without code changes to the client.
50. As a caregiver, I want Avelo to remain fully runnable with a clearly labeled deterministic fallback extractor when real voice/AI credentials are not configured, so that the demo always works, and so that the fallback is never mistaken for a real model call.

### Validation

51. As a caregiver, I want manual entry and voice-populated updates to be checked by the same shared validation rules, so that the form behaves consistently no matter how I filled it in.
52. As a caregiver, I want a submit attempt with missing or invalid required fields to show red borders, descriptive English error messages, and an accessible error summary, so that I understand exactly what needs to be fixed.
53. As a caregiver, I want the page to focus and scroll to the first invalid field when I try to submit with errors, so that I can find and fix the problem quickly.
54. As a caregiver, I want submission to be blocked while validation errors remain, but I still want full access to microphone and manual editing, so that I can resolve the errors using whichever input method I prefer.
55. As a caregiver, I want a resolved validation error to disappear once I fix it, without disturbing my other entered information, so that correcting one field never costs me progress elsewhere.
56. As a caregiver, I want Avelo to validate required contact and passenger information, required pickup/destination locations, a future trip date and time, a meaningful required arrival time, a suggested pickup time that is valid for the selected date, a return pickup time that is later than the required arrival time, a valid companion count, and a required mobility selection, so that an arrangement request is never submitted with an incoherent or incomplete trip.
57. As a caregiver, I want validation errors to be indicated with more than color alone (for example, icons and text), so that the errors are understandable to caregivers with color vision differences.

### Pricing & Special Requests

58. As a caregiver, I want to receive an initial round-trip price estimate immediately after describing my trip, even if I have special requests, so that I am never diverted to a separate manual-quote process before I can submit.
59. As a caregiver, I want the price estimate to be calculated deterministically from a documented route-distance fixture, the vehicle accessibility category, both the outbound and return legs, and the supported standard assistance options, so that the pricing is transparent and reproducible.
60. As a caregiver, I want to see the outbound estimate, the return estimate, the round-trip total, and whether special-request costs are still pending, so that I understand exactly what I am being quoted.
61. As a caregiver, I want to see the exact notice "This estimate may not include additional costs for special requests. We will confirm these with the provider. If the price changes, we will notify you and ask for your approval before confirming the booking." whenever a special request is present, so that I understand the price may still change.
62. As a caregiver, I want my initial "Request Arrangement" action to authorize the arrangement at the displayed estimate, so that I know exactly what I am agreeing to when I submit.
63. As a caregiver, I want the booking to auto-confirm with no extra click when the matched provider accepts at the same price, so that a smooth match does not require redundant approval steps from me.
64. As a caregiver, I want a price change to pause confirmation and show me the original price, the revised total, the difference, and a specific reason for the change, so that I can make an informed decision.
65. As a caregiver, I want "Accept New Price and Confirm" and "Find Another Option" actions when the price changes, so that I can either accept the new price or ask Avelo to keep searching.
66. As a caregiver, I want accepting the new price to confirm the booking, and choosing to find another option to resume the provider search, so that both paths lead somewhere clear and actionable.
67. As a caregiver, I want to be reassured that no real payment is collected at any point in this demo, so that I understand the financial aspect is simulated.

### Suggested Pickup Time

68. As a caregiver, I want the suggested pickup time to be calculated as the required arrival time minus the route's travel duration minus a documented prep/arrival buffer, so that the passenger arrives on time without me doing the math.
69. As a caregiver, I want to see an explanation such as "Suggested pickup: 8:30 AM, allowing 60 minutes for travel and a 30-minute arrival buffer," so that I understand how the suggested time was derived.
70. As a caregiver, I want the suggested pickup time to never be described as based on live traffic, so that I am not misled about the simulated nature of the calculation.
71. As a caregiver, I want the suggested pickup time and any stale estimate or review data to recalculate or invalidate automatically when I change a relevant input, so that I am never shown an outdated or inconsistent time or price.
72. As a caregiver, I want to see an actionable error, rather than a silently shifted date, when the calculated pickup time falls outside supported same-day behavior, so that I understand why my requested time cannot be honored and what to do instead.

### Matching & Booking State

73. As a caregiver, I want distinct states for request submitted, candidate found, provider accepted, and booking confirmed, so that I understand a candidate match alone is never the same as a confirmed booking.
74. As a caregiver, I want the simulated matching to consider service area, scheduled times, wheelchair accommodation, companion capacity, supported assistance options, and both legs of the trip, so that any match reflects the actual requirements of the trip.
75. As a caregiver, I want special requests to remain attached and visible in the arrangement summary throughout the process, so that I can confirm they were not dropped along the way.
76. As a caregiver, I want Avelo to never imply that an arbitrary special request is guaranteed to be honored, and to show an honest "unable to arrange" state when a request cannot be supported, so that my expectations stay realistic.
77. As a caregiver, I want the booking status to follow a documented state machine that prevents impossible transitions and duplicate submissions, so that the booking process behaves predictably and cannot be put into an inconsistent state.

### Demo Scenarios

78. As a presenter, I want a discreet, clearly labeled Demo Controls area, so that I can load fictional example data, choose a scenario, reset the app, and reliably repeat a demo.
79. As a presenter, I want a Standard Arrangement scenario — a standard wheelchair request with a complete outbound and return schedule, an estimate, a brief search, same-price acceptance, and auto-confirmation — so that I can demonstrate the simplest successful path end to end.
80. As a presenter, I want a Special Request / Price Revision scenario — an estimate with a special-request notice, a search, a revised price with a concrete reason, an "Accept New Price and Confirm" path, and a "Find Another Option" path that resumes the search — so that I can demonstrate the price-approval flow end to end.
81. As a presenter, I want a Replacement scenario that starts from a confirmed arrangement, lets me request a replacement with a reason, shows a replacement search, and on success shows the updated provider and arrangement while the original confirmed arrangement is retained until the replacement is finalized, with any new price requiring approval before the replacement becomes final, so that I can demonstrate the replacement flow end to end.
82. As a presenter, I want an optional Unavailable-Provider scenario available for later addition, so that the demo can eventually show an honest "unable to arrange" outcome as well.
83. As a presenter, I want every scenario to use only fictional providers and passengers and to be clearly labeled as a simulation, so that no one mistakes the demo for real transportation data.
84. As a presenter, I want a scenario to never silently change mid-flight, so that each run of a demo behaves exactly as expected.
85. As a presenter, I want "Reset" to clear the current form and booking, validation errors, the voice transcript, any in-progress recording or extraction state, scenario timers, and relevant persisted demo state, so that I can start a clean run every time.
86. As a presenter, I want any late response from a session that has since been reset to never repopulate the new session, so that a reset reliably produces a clean slate with no leftover state bleeding through.

### Visual & Accessibility

87. As a caregiver, I want a warm, calm, and approachable visual design using a cream background, white cards, dark green text, soft teal primary actions, and accessible red error styling, so that the experience feels reassuring rather than clinical or alarming during a stressful time.
88. As a caregiver, I want large readable type, generous spacing, explicit labels, large touch targets, visible keyboard focus, strong contrast, plain English, and clear progress indication, so that the product is comfortable and easy to use regardless of my age, stress level, or device.
89. As a caregiver, I want the design to avoid dense dashboards, medical imagery, excessive animation, jargon, and unsupported trust badges, so that the experience stays approachable and does not overstate its clinical or regulatory status.
90. As a caregiver using assistive technology, I want accessible semantics and status announcements, and keyboard-operable dialogs with correct focus handling, so that I can use Avelo fully with a screen reader or keyboard alone.
91. As a caregiver, I want all app-controlled content, including error messages and fallback text, to be presented in English, so that the experience is consistent and understandable throughout.

### Architecture

92. As a developer, I want the system built as a small, maintainable TypeScript stack using Next.js (App Router for UI, API routes for voice extraction, estimation, and booking) in a single codebase, so that the project stays simple to build, run, and reason about for the hackathon timeline.
93. As a developer, I want clearly separated responsibilities for form/validation, voice transcription and extraction, incremental field updates, estimation, suggested-pickup calculation, provider simulation, booking state, and presentation, so that each concern can be developed, tested, and reasoned about independently.
94. As a developer, I want small, explicit backend endpoint contracts, so that the client and server have an unambiguous, documented interface.
95. As a developer, I want all AI/voice extraction output validated server-side before it is applied to form state, so that an AI response can never freely mutate arbitrary application state.
96. As a developer, I want minimal persistence appropriate for fictional demo data, with documented storage behavior and limitations, so that the project does not take on unnecessary production-database complexity just because the code lives in a public repository.
97. As a developer, I want explicit loading and error handling throughout the application, so that every asynchronous operation has a defined, visible outcome for the caregiver.
98. As a developer, I want duplicate booking requests to be prevented, so that a double-click or retry can never create two arrangements for the same request.
99. As a developer, I want API keys to never be stored in source control, the client bundle, or browser storage, so that credentials for any real provider integration stay secure.

### Kiro & Submission

100. As a submission reviewer, I want to see meaningful use of Kiro throughout the project, with the root `.kiro` directory kept in the repository and specs driving the implementation, so that the Kiro-driven development process is visible and verifiable.
101. As a submission reviewer, I want steering guidance that preserves English-only output, the defined product scope, the voice merge semantics, the visual style, and the testing principles, so that these decisions stay consistent as the implementation proceeds.
102. As a submission reviewer, I want at most one real, working hook for validation or quality, with a documented trigger, action, and benefit, so that any Kiro automation included is genuine rather than decorative.
103. As a submission reviewer, I want the project to never add integrations or hooks solely to claim usage, and to never fabricate usage evidence, so that the submission accurately represents the work done.
104. As a submission reviewer, I want a completed README with exact setup/run commands, an env var example containing no secrets, testing instructions, deployment instructions, a real-vs-simulated functionality explanation, a product description, a Kiro usage write-up, a video script/shot list of about 2 minutes 50 seconds (under 3 minutes), and a submission checklist, so that the project is fully documented for review.
105. As a project owner, I want no publishing, uploading, or submission to occur without my explicit authorization, so that I retain control over when and how the project is shared externally.

### Acceptance Criteria Seeds (Traceable)

106. **(AC-VOICE-01)** As a caregiver, I want that given a form with an existing hospital name and time already filled in, when I speak a new instruction mentioning only a different hospital name and time, then only the hospital name and time fields update and all other fields remain unchanged, so that a follow-up correction never disturbs unrelated data.
107. **(AC-VOICE-02)** As a caregiver, I want that given a form with existing data, when my voice input is ambiguous about which leg or field it refers to, then Avelo asks a focused English clarifying question and preserves all unrelated data without modification, so that ambiguity never silently corrupts my booking.
108. **(AC-VALIDATION-01)** As a caregiver, I want that given a booking form with one or more required fields missing or invalid, when I attempt to submit, then Avelo blocks submission, shows descriptive English errors with an accessible error summary, and focuses the first invalid field, so that I always know what to fix before proceeding.
109. **(AC-BOOKING-01)** As a caregiver, I want that given a submitted arrangement request, when the simulated provider accepts at the originally displayed price, then the booking status transitions directly to Booking Confirmed with no additional approval step, so that a clean match completes without extra friction.
110. **(AC-PRICE-01)** As a caregiver, I want that given a submitted arrangement request with a displayed estimate, when the simulated provider responds with a different price, then Avelo shows the original price, the revised total, the difference, and a specific reason, and withholds confirmation until I choose "Accept New Price and Confirm" or "Find Another Option," so that I retain control over any price change.
111. **(AC-TIME-01)** As a caregiver, I want that given a required arrival time and a route fixture with a travel duration and documented buffer, when the form calculates the suggested pickup time, then the displayed time equals the required arrival time minus the travel duration minus the buffer, with an explanation of both components shown, so that the suggested time is transparent and verifiable.
112. **(AC-DEMO-01)** As a presenter, I want that given an in-progress or completed demo scenario, when I trigger Reset from the Demo Controls, then the form, booking, validation errors, transcript, recording/extraction state, scenario timers, and relevant persisted demo state are all cleared, and any late response from the prior session never repopulates the new session, so that every demo run starts from a verified clean state.

## Implementation Decisions

- Avelo is built as a single Next.js + TypeScript application: the App Router serves the UI (landing, booking form, estimate/review, booking status, arrangement details, demo controls), and Next.js API routes serve voice extraction, estimation, and booking endpoints. There is no separate backend service.
- Voice input uses a deterministic fallback extractor by default. This fallback is clearly labeled in the UI and in code comments as a demo fallback, never represented as a real AI/model call. A server-side adapter interface, selected and configured via environment variables, defines the contract for plugging in a real speech-to-text provider and a real LLM-based extraction provider later. No provider credentials or secrets are ever exposed to the client bundle; all real-provider calls, if configured, happen server-side only.
- Pricing, route-distance, and suggested-pickup-time calculations are deterministic and driven by fixtures documented in one place in the codebase, so that the same inputs always produce the same outputs and the logic is auditable.
- Booking status follows a single, documented state machine that is the sole source of truth for status transitions (request submitted → candidate found → provider accepted → booking confirmed, plus price-revision, replacement, and unable-to-arrange paths). All transitions are validated against this state machine to prevent impossible transitions or duplicate submissions.
- Persistence is minimal and appropriate for a hackathon demo — in-memory or file-based storage of fictional demo data — rather than a production database. Storage behavior and its limitations (e.g., data not surviving a server restart) are documented.
- All AI/voice extraction output is validated and type-checked server-side before it is merged into form state. AI responses are never allowed to freely mutate arbitrary application state.
- Manual form entry and voice-populated updates share one validation module, so that both input paths enforce identical rules and produce identical error messaging.
- The application runs locally only for this phase. Deployment instructions are documented in the README for future use but are not executed as part of this work.

## Testing Decisions

- Testing is centered on full caregiver journeys: end-to-end-style coverage of the Standard Arrangement flow, the Special Request / Price Revision (price-approval) flow, the Replacement flow, and a repeat-after-reset flow, so that the externally observable behavior a caregiver actually experiences is verified.
- Focused/unit tests cover the voice field-merge rules (latest-value-wins per mentioned field, preservation of unmentioned fields, leg disambiguation, no auto-submission) and the pricing/booking state-machine rules (deterministic pricing output, valid and invalid state transitions), independent of UI concerns.
- Test boundaries are kept small in number and target externally observable behavior rather than internal implementation details, so that tests remain stable as the implementation evolves.
- Where useful, property-based tests validate the merge contract directly: a patch changes only the fields it mentions, unmentioned fields are left unchanged, reapplying the same patch is idempotent, and the latest value wins whenever two patches overlap on the same field.
- Because the project directory starts empty, there is no existing codebase or test precedent to preserve; the test suite is established from scratch alongside the implementation.
- Test results are documented truthfully based on actual execution; no test outcome is ever claimed or reported without having actually been run.

## Out of Scope

- Emergency dispatch or clinical triage of any kind.
- Live fleet integration with real transportation providers.
- Real provider onboarding or a provider-facing portal.
- Driver-facing or dispatcher-facing interfaces.
- Real-time vehicle tracking.
- Actual payment processing or insurance billing.
- Prescription pickup or delivery.
- Flexible "call when ready" return pickup (the MVP uses a fixed, caregiver-chosen return pickup time only).
- Recurring or repeating bookings.
- Production healthcare-record management.
- Any guarantee of transportation availability.
- Any claim of production-grade security certification or regulatory compliance.
- Repetitive non-emergency warnings throughout the UI; one concise non-emergency statement on the landing page is sufficient and additional repeated warnings that disrupt the flow are avoided.

## Further Notes

**Assumptions requiring documentation:**
- Both the outbound and return legs of a booking occur on the same trip date.
- All addresses used in the demo are fictional and are not verified against any real address-validation service; Avelo only performs basic completeness checks and never claims stronger address verification than that.
- Price estimates, route distances, and suggested pickup times are derived from documented demo fixtures, not from live traffic or mapping data, and are never described as such.
- The deterministic voice/extraction fallback is clearly not a real AI model call unless and until real speech-to-text and LLM provider credentials are configured through the documented adapter and environment variables.
- The application is run locally only for this phase of work; deployment is documented but intentionally not executed now.

**External dependencies (optional, pluggable):**
- A real speech-to-text provider may be plugged in later via the server-side adapter and environment-variable configuration described above.
- A real LLM-based extraction provider may be plugged in later via the same adapter pattern.
- Both integrations are optional: the application must remain fully runnable, using the deterministic fallback, with neither provider configured.
