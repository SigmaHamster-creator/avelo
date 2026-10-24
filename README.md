# Avelo

**Every journey, thoughtfully arranged.**

Scheduled rides for your loved ones, matched to their needs.

**Hackachusetts, powered by Kiro. Track: Healthcare & Biotech.**

Avelo helps a family caregiver in rural Massachusetts arrange scheduled, non-emergency medical transportation for
a loved one with mobility limitations. The caregiver describes the trip once, by typing or by speaking in English,
and Avelo fills in the form, works out when the passenger should be picked up, shows a round-trip estimate, and
arranges a provider that can handle a wheelchair, companions, and both legs of the trip.

- **Live demo:** _add the hosted URL here after deploying (see "Deploy" below)_
- **Demo video:** _add the public YouTube/Vimeo link here_
- **Product description:** [PROJECT_DESCRIPTION.md](PROJECT_DESCRIPTION.md)
- **How Kiro was used:** [KIRO_USAGE.md](KIRO_USAGE.md)
- **Specs that drove the build:** [.kiro/specs/avelo/](.kiro/specs/avelo/) (requirements, design, tasks)

Provider matching in this MVP is simulated with fictional providers, hospitals, and addresses. No login and no real
payment. Avelo is not an emergency service.

## Repository layout

| Path | What it is |
|---|---|
| `.kiro/specs/avelo/` | Kiro spec: `requirements.md`, `design.md`, `tasks.md` (with acceptance matrix and implementation status) |
| `.kiro/steering/` | Steering files Kiro loads automatically (scope, English-only, voice-merge rules, visual style, testing) |
| `.kiro/hooks/` | Agent hook that runs the domain tests whenever a domain module is saved |
| `avelo/` | The Next.js + TypeScript application, tests, and app-level README |
| `render.yaml` | One-click deployment blueprint for Render |

## Run it locally

Requires Node.js 20.9 or newer.

```powershell
cd avelo
npm install
npm run dev
```

Open http://localhost:3000 in Chrome or Edge (voice input uses the browser's speech recognition; other browsers get
the text box, which uses the same pipeline). No API keys or environment variables are needed.

Quick tour: click **Demo Controls** (bottom right), pick a scenario, click **Load Example Data**, then **Review
Estimate** and **Request Arrangement**.

## Test it

```powershell
cd avelo
npm test                          # 68 unit and property-based tests (Vitest + fast-check)
npx playwright install chromium   # first time only
npm run test:e2e                  # builds, then runs 6 end-to-end journeys (Playwright)
```

## Deploy

Avelo keeps demo bookings in server memory, so it needs **one long-running Node process** (Render, Railway, Fly.io,
or any VM). Serverless hosts such as Vercel are not supported, because their functions don't share memory or keep
background timers running.

On Render: **New > Blueprint**, select this repository, and Render reads `render.yaml` (root directory `avelo`,
build `npm ci && npm run build`, start `npm start`). The free plan sleeps when idle, and a restart clears demo
bookings, which is fine for judging.

More detail: [avelo/README.md](avelo/README.md).
