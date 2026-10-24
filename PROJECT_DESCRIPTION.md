# Avelo: project description

**Track:** Healthcare & Biotech
**Tagline:** Every journey, thoughtfully arranged.

## The problem

A daughter in a small Massachusetts town needs to get her father, who uses a wheelchair, to a 10 AM appointment
at a regional hospital 40 minutes away, and home again afterward. Today that means calling transportation
providers one by one to find someone who serves the town, has a wheelchair-accessible vehicle, has room for her
to ride along, and can do both the drop-off and the pickup. Then she has to work backward from the appointment to
figure out the pickup time.

Missing a ride means missing care. For caregivers who are already managing medications, appointments, and work,
this coordination is a real and repeated burden.

## What Avelo does

The caregiver describes the trip once. Avelo does the rest of the coordination.

- **Describe it your way.** Fill in a short form, or speak in plain English: "She needs to be at Pine Valley
  Hospital by 10 a.m. tomorrow. She can't transfer, she stays in her wheelchair." Speech and typing update the
  same form.
- **Corrections that feel natural.** Say "Pick her up from the hospital at 4 p.m." afterward and only the return
  pickup time changes. Nothing else is touched. You never have to say "change" or "update". If Avelo isn't sure
  what you meant ("three or four, I'm not sure"), it asks instead of guessing.
- **Hospital addresses fill themselves in.** Name a hospital in the directory and its address appears, so the
  caregiver doesn't need to look it up.
- **The math is done for you.** Avelo works out the suggested pickup time from the arrival time, travel time, and
  a buffer, and explains it: "Suggested pickup: 8:30 AM, allowing 60 minutes for travel and a 30-minute arrival
  buffer."
- **An honest estimate up front.** Everyone sees an outbound, return, and round-trip estimate immediately, even
  with special requests. If special needs might change the price, Avelo says so.
- **No surprise charges.** If the provider's price matches, the booking confirms automatically. If it changes,
  Avelo shows the original price, the new price, the difference, and the specific reason, and waits for the
  caregiver to accept or ask for another option.
- **Changes after booking.** The caregiver can ask for a different arrangement. The confirmed ride stays in place
  until a replacement is confirmed, so they are never left without one.

## Who benefits and why it matters

- **Caregivers** spend minutes, not an afternoon on the phone, and get one clear arrangement.
- **Passengers with mobility limitations** are matched only to vehicles that fit their needs (wheelchair
  accommodation and companion capacity are hard requirements, never "best effort").
- **Clinics and hospitals** could see fewer missed appointments caused by transportation, a known barrier to care
  in rural areas.

## Accessibility and equity

Avelo is designed for people under stress, often older adults or caregivers on a phone:

- Large text, large touch targets, generous spacing, and a calm cream, white, and teal palette.
- Voice input for people who find typing hard, with a text box that does the same thing for anyone without a
  microphone or a supported browser.
- Errors use an icon and plain-English text, never color alone. Screen readers get an error summary, live status
  announcements, and focus management. Dialogs work with the keyboard alone.
- Plain language throughout, and no account or payment required to try it.
- The form asks only what transportation needs. It collects no medical history or demographic data.

(Full WCAG conformance would still need manual testing with assistive technologies, which has not been done.)

## How it scales beyond the hackathon

The parts that would be replaced in production sit behind small, explicit interfaces:

- **Providers:** the simulated matcher already checks service area, wheelchair accommodation, companion capacity,
  and both trip legs. Real providers or a regional dispatch service would plug in behind the same contract.
- **Voice understanding:** extraction runs behind a server-side adapter. Today it is a transparent rule-based
  extractor, clearly labeled as such. A language model can be added with server-side environment variables, and
  every response is validated before it can touch the form.
- **Addresses, routes, and prices:** the fictional hospital directory and route tables would be replaced by real
  facility, routing, and pricing data behind the same functions.

## What is real and what is simulated

| Real, working code | Simulated with fictional data |
|---|---|
| The booking form, shared validation, browser speech capture, voice and text extraction, field merging and undo, pickup-time and price calculation, the booking state machine, the price-approval and replacement flows | Providers, provider acceptance and price changes, hospital addresses, route distances. No login, no payments. |

## How it was built

Built entirely in the Kiro IDE using spec-driven development: 112 user stories, a design with 20 correctness
properties, and 104 tasks with a 49-row acceptance matrix, written before any code. Steering files and an agent
hook keep it on track, and it is tested with 68 unit and property-based tests and 6 end-to-end journeys. See
[KIRO_USAGE.md](KIRO_USAGE.md).

**Stack:** Next.js (App Router), TypeScript, Vitest, fast-check, Playwright.
