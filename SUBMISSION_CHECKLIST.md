# Hackachusetts submission checklist

Mapped to the official rules. **Done** means it was done and checked; **You** means it needs your account or
decision.

| Rule | Status | Notes |
|---|---|---|
| Team members added (max 4) | **You** | On the hackathon website. |
| Built with Kiro | Done | See `KIRO_USAGE.md` and `.kiro/`. |
| Challenge track identified | Done | Healthcare & Biotech (README, `PROJECT_DESCRIPTION.md`). Select it on the form too. |
| Text description of features | Done | `PROJECT_DESCRIPTION.md`, ready to paste. |
| Demo video under 3 minutes, showing the app running | **You** | Script: `VIDEO_SCRIPT.md` (2:50). No copyrighted music or third-party logos. |
| Video public on YouTube/Vimeo, link on the form | **You** | Add the link to `README.md` too. |
| Public GitHub repo with all code, assets, and instructions | Done | https://github.com/SigmaHamster-creator/avelo (public, branch `main`). |
| `.kiro/` at the repo root, not ignored | Done | Confirmed on GitHub: `.kiro/hooks`, `.kiro/specs`, `.kiro/steering`. |
| Kiro write-up (tools, specs, hooks, steering, MCP, PBT, powers) | Done | `KIRO_USAGE.md` answers each question, including what was not used. |
| Working project accessible to judges, free | Done | https://avelo-lisn.onrender.com (Render free plan, deployed from `render.yaml`). |
| English materials | Done | All app copy, docs, and data are English. |
| Original work, no third-party IP | Done | Default Next.js/Vercel logos and favicon removed; Avelo uses its own icon. All names, hospitals, providers, and addresses are fictional. |
| Open-source license | **You** (optional) | Not added. Choose one (for example MIT) if you want others to be able to reuse the code. |

## Verified

Locally:

- `npm test` in `avelo/`: 68/68 passed (9 files)
- `npm run test:e2e` in `avelo/`: 6/6 passed against the production build
- `next build`, `tsc --noEmit`, `eslint src e2e`: clean
- Hook command `npm --prefix avelo test -- src/domain/__tests__` from the repo root: 57/57 passed

On the live site (https://avelo-lisn.onrender.com), through its real API:

- Home page serves Avelo
- Standard booking: estimate $145.60 with the 8:30 AM pickup explanation, then auto-confirmed with Pioneer Valley Rides
- Special request: estimate shows special-request costs pending; provider proposes +$15 (oxygen tank assistance);
  accepting confirms at $122.00
- Replacement: the original provider stays shown during the search, then Berkshire Accessible Transport confirms
- Voice: "pick him up from the hospital at 2 p.m." sets only the return pickup; "take her to quabbin regional by
  9 a.m." sets the hospital and arrival time

Not verified: real-microphone voice input across browsers (needs a human), screen-reader testing.

## Known limitation of the free hosting

Render's free plan sleeps after about 15 minutes without traffic. The first visit after that takes up to a minute,
and a restart clears demo bookings (the app keeps them in memory by design). Open the site once a few minutes
before recording the video or before judging.

## Steps left for you

1. **Record and upload** the video using `VIDEO_SCRIPT.md`. Use the live site or `npm run dev`. Set the video to
   Public.
2. **Add the video link** to `README.md` (replace the placeholder), then commit and push, or ask Kiro to.
3. **Submit the form:** description (`PROJECT_DESCRIPTION.md`), track (Healthcare & Biotech), video link, repo URL,
   demo URL, team members, and the Kiro write-up (`KIRO_USAGE.md`).

Make the final push before the submission deadline. Nothing can change afterward.
