# Hackachusetts submission checklist

Mapped to the official rules. **Done** means it was done and checked here; **You** means it needs your account or
decision.

| Rule | Status | Notes |
|---|---|---|
| Team members added (max 4) | **You** | On the hackathon website. |
| Built with Kiro | Done | See `KIRO_USAGE.md` and `.kiro/`. |
| Challenge track identified | Done | Healthcare & Biotech (README, `PROJECT_DESCRIPTION.md`). Select it on the form too. |
| Text description of features | Done | `PROJECT_DESCRIPTION.md`, ready to paste. |
| Demo video under 3 minutes, showing the app running | **You** | Script: `VIDEO_SCRIPT.md` (2:50). No copyrighted music or third-party logos. |
| Video public on YouTube/Vimeo, link on the form | **You** | Add the link to `README.md` too. |
| Public GitHub repo with all code, assets, and instructions | Ready, **you** publish | Repo root is this folder (`The Engine`). Git is not installed on this machine yet (see below). |
| `.kiro/` at the repo root, not ignored | Done | Root and app `.gitignore` files checked: neither ignores `.kiro/`. |
| Kiro write-up (tools, specs, hooks, steering, MCP, PBT, powers) | Done | `KIRO_USAGE.md` answers each question, including what was not used. |
| Working project accessible to judges, free | Ready, **you** deploy | `render.yaml` included. Add the live URL to `README.md` and the form. |
| English materials | Done | All app copy, docs, and data are English. |
| Original work, no third-party IP | Done | Default Next.js/Vercel logos and favicon removed; Avelo uses its own icon. All names, hospitals, providers, and addresses are fictional. |
| Open-source license | **You** (optional) | Not added. Choose one (for example MIT) if you want others to be able to reuse the code. |

## Verified in this environment

- `npm test` in `avelo/`: 68/68 passed (9 files)
- `npm run test:e2e` in `avelo/`: 6/6 passed against the production build
- `next build`, `tsc --noEmit`, `eslint src e2e`: clean
- Production server smoke test: estimate, booking, auto-confirmation, and voice extraction all worked on `next start`
- Hook command `npm --prefix avelo test -- src/domain/__tests__` run from the repo root: 57/57 passed

Not verified: real-microphone voice input across browsers (needs a human), screen-reader testing, a hosted
deployment.

## Steps to finish

1. **Install Git** (https://git-scm.com/download/win), then from this folder:
   ```powershell
   git init
   git add .
   git status   # confirm .kiro/ is listed and node_modules/.next are not
   git commit -m "Avelo: Hackachusetts submission"
   ```
2. **Create a public GitHub repo** (for example `avelo`), then:
   ```powershell
   git remote add origin https://github.com/<you>/avelo.git
   git branch -M main
   git push -u origin main
   ```
3. **Deploy:** on Render, choose New > Blueprint and select the repo. Open the URL and run one Standard booking.
4. **Record and upload** the video using `VIDEO_SCRIPT.md`. Set it to Public.
5. **Fill in the README** placeholders (live URL and video link), commit, and push.
6. **Submit the form:** description, track, video link, repo URL, demo URL, team members, Kiro write-up.

Make the final push before the submission deadline. Nothing can change afterward.
