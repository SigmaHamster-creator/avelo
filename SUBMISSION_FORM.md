# Avelo: copy-paste answers for the submission form

Fill these in on your campus's Hackachusetts submission page (usually Devpost). Field names vary; match by meaning.

---

## Project name
Avelo

## Tagline / elevator pitch (under 200 characters)
Caregivers describe a loved one's medical trip once, by voice or typing. Avelo fills the form, plans the pickup, quotes the round trip, and arranges a wheelchair-ready ride.

## Challenge track
Healthcare & Biotech

## Links
- **Try it out (live demo):** https://avelo-lisn.onrender.com
- **GitHub repository:** https://github.com/SigmaHamster-creator/avelo
- **Demo video:** _your YouTube/Vimeo link (must be Public)_

## Built with (tags)
kiro, typescript, next.js, react, node.js, web-speech-api, vitest, fast-check, playwright, render

---

## About the project (main description, Markdown)

### Inspiration
Getting a parent who uses a wheelchair to a hospital appointment in rural Massachusetts, and home again, often
means calling provider after provider. You're checking who serves your town, who has an accessible vehicle, who has
room for you to ride along, and who can do both trips. Then you work backward from the appointment time to figure
out the pickup. Missing a ride means missing care.

### What it does
Avelo lets a caregiver describe the trip once and handles the coordination.

- **Speak or type in plain English.** "My dad needs to be at Pine Valley Hospital by 10 a.m. tomorrow. He can't
  transfer, he stays in his wheelchair, and I'll be coming with him." Avelo fills in the hospital, its address, the
  date, the arrival time, the wheelchair need, and the companion.
- **Natural corrections.** "Pick him up from the hospital at 2 p.m." changes only the return pickup. Nothing else is
  touched, and there's no need to say "change". If you sound unsure ("three or four, I'm not sure"), it asks rather
  than guesses.
- **Pickup time worked out for you,** with the reasoning shown: "Suggested pickup: 8:30 AM, allowing 60 minutes for
  travel and a 30-minute arrival buffer."
- **Round-trip estimate up front** for everyone, including people with special requests.
- **No surprise charges.** Same price: the booking confirms automatically. Changed price: Avelo shows the old
  price, the new price, the difference, and the reason, and waits for the caregiver.
- **Replacement requests** keep the confirmed ride in place until a new one is confirmed.
- **Accessible by design:** large text and touch targets, errors shown with an icon and text (never color alone),
  screen-reader announcements, keyboard-friendly dialogs, and no login or payment.

Providers, hospitals, and addresses are fictional and simulated in this MVP, and the app labels them that way.

### How we built it
Built in the **Kiro IDE** using **spec-driven development**. Before any code existed, Kiro's spec workflow
produced 112 user stories, a technical design with 20 correctness properties, and 104 small tasks with a 49-row
acceptance matrix (`.kiro/specs/avelo/`). **Steering files** keep scope, English-only output, voice-merge rules,
visual style, and testing principles consistent. An **agent hook** re-runs the domain tests whenever a domain file is
saved. The stack is Next.js and TypeScript, with the browser's speech recognition for voice. Testing uses 68 unit
and **property-based** (fast-check) tests plus 6 end-to-end Playwright journeys. The app is deployed on Render.

### Challenges we ran into
Voice was the hard part. Real browser transcripts say "4 p.m." in lowercase, and the first version cut people off
at their first pause. The trickiest bug was meaning: "pick her up *from* the hospital at 4" is the ride *home*, not
the arrival time. One of our own tests had encoded the wrong expectation, so it passed anyway. Manual testing caught
it, and we rewrote the leg resolution and replaced the test with real speech-style phrases.

### Accomplishments that we're proud of
The rule "the latest input wins for every field it mentions; everything else is preserved" holds for voice and
typing alike, and property-based tests check it. A candidate provider is never shown as a confirmed booking, and a
price change never confirms without the caregiver's approval.

### What we learned
A spec makes the hard rules explicit before code exists. But a test is only as good as its expected value, and
testing with a real person and a real microphone found what automated tests missed.

### What's next for Avelo
Connect real regional transportation providers and dispatch behind the existing matching contract. Add a language
model behind the existing server-side voice adapter, where every response is already validated. Replace the
fictional hospital and route data with real facility and routing data.

---

## How Kiro was used (if the form has a separate field)

Paste the contents of `KIRO_USAGE.md`, or this short version:

> **Tools:** Kiro IDE (agent in Autopilot), the spec workflow, sub-agents, steering, and one agent hook. We did not
> use Kiro CLI, Web, Crew, MCP, or Powers.
> **Specs:** The brief became requirements (112 user stories), a design (20 correctness properties, API contracts,
> state machine), and tasks (104 tasks, 49-row acceptance matrix), each validated before the next. A review pass
> found 6 requirements with no task and added them before coding. The design's module names became the code's file
> names, and its state table was copied into the state machine.
> **Steering:** five files. Two always apply (scope, English-only). Three load only for matching files (voice-merge
> rules, visual style, testing). They were written after the first pass and guided the later voice and
> hospital-address work.
> **Hook:** on save of any `avelo/src/domain/*.ts` file, runs the 57 domain tests. Added late; its value is
> protecting future changes.
> **PBT:** fast-check properties for the merge contract, pricing, pickup-time formula, state machine, matching
> guards, return-leg defaults, and validation of extractor output. They gave confidence across many inputs, but
> manual testing, not PBT, found the bugs.
> Full details: https://github.com/SigmaHamster-creator/avelo/blob/main/KIRO_USAGE.md
