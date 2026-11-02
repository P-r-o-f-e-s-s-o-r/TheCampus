# SapiensCampus

**Discover yourself. Find your people.**

SapiensCampus is a digital campus for curious students — a place to explore interests beyond college walls, meet peers across campuses, and eventually build real things together.

This repository ships the **Explore** experience: a ~2-minute, RIASEC-inspired interest discovery flow, followed by an optional waitlist signup for what comes next (**Evolve** and **Engineer**).

---

## Overview

| | |
|---|---|
| **Product** | SapiensCampus interest discovery + waitlist |
| **Stack** | Single-page HTML / CSS / vanilla JS |
| **Hosting** | [Firebase Hosting](https://firebase.google.com/docs/hosting) |
| **Firebase project** | `sapienscampus-97b6a` |
| **Hosting site** | `sapienscampus` |
| **Repo** | [P-r-o-f-e-s-s-o-r/TheCampus](https://github.com/P-r-o-f-e-s-s-o-r/TheCampus) |

There is **no build step** and **no npm package**. The entire front end lives in one self-contained file: `web/Evelve/index.html` (styles, SVG icons, discovery engine, and UI).

---

## Product journey

The product is framed as a three-stage campus path:

1. **Explore** *(live)* — 30 short activity prompts → interest mix + persona suggestion  
2. **Evolve** *(next)* — peers across colleges, fresh perspectives  
3. **Engineer** *(next)* — small starts, real builds  

The landing page, quiz, results, and waitlist all run as screens inside one progressive single-page app — no separate routes or frameworks.

---

## Features

### Interest discovery
- **30 original prompts** across six RIASEC-inspired areas (5 each)
- **5 rounds** of 6 prompts; every round includes all six areas
- Three gut reactions: **Not for me** (0) · **Maybe** (1) · **I’d love it** (2)
- Keyboard shortcuts `1` / `2` / `3` on the quiz screen
- Pause / resume, back navigation, and edit-from-review
- Progress saved in `sessionStorage` for the current browser tab

### Results
- Interest “passport” with persona title and direction tags
- Full **RIASEC mix** score bars (0–10 per area)
- Leading interest pattern code (ties preserved in brackets)
- Small experimental “try this” missions
- Answer review with live re-scoring
- Clear disclaimer: not a talent test, career verdict, or validated assessment

### Waitlist
- Email signup posts to `POST /api/waitlist`
- Optional: quiz answers + area scores attached when the quiz is complete
- Honeypot field for basic bot resistance
- Offline `file://` preview shows a note instead of submitting

### Accessibility & UX
- Skip link, focus management, live regions for status updates
- `prefers-reduced-motion` respected
- Print styles for results
- Responsive layout from ~360px phones through large desktops

---

## Interest model (RIASEC-inspired)

| Code | Area | Persona (example) |
|------|------|-------------------|
| **R** | Realistic — hands-on | The hands-on maker |
| **I** | Investigative — curious | The curious investigator |
| **A** | Artistic — creative | The creative explorer |
| **S** | Social — people-first | The people connector |
| **E** | Enterprising — taking the lead | The bold initiator |
| **C** | Conventional — organized | The thoughtful organizer |

**Scoring**
- 5 prompts × score 0–2 → area total **0–10**
- Equal scores stay tied (`[R + I]` means equal, not ranked)
- Low / flat patterns get an open or “multi-curious” result instead of a forced persona
- Pair personas exist for strong two-letter patterns

> These prompts and personas were created for SapiensCampus. This is **not** the O*NET Interest Profiler and has **not** been validated as a psychometric assessment. See the in-app “How this works & your privacy” panel for details.

---

## Project structure

```
TheCampus/
├── .firebaserc                          # Default Firebase project
├── firebase.json                        # Root hosting config (used by CI)
├── .github/workflows/
│   ├── firebase-hosting-merge.yml       # Deploy to live on push to main
│   └── firebase-hosting-pull-request.yml# Preview channels on PRs
├── web/
│   ├── index.html                       # Redirects / → /Evelve/
│   ├── firebase.json                    # Site + API rewrite config
│   ├── Explore/                         # Reserved for Explore stage
│   ├── Evelve/
│   │   └── index.html                   # Full app (UI + Discovery engine)
│   └── Engineer/                        # Reserved for Engineer stage
├── .agents/ / .claude/                  # Local agent skills (Firebase tooling helpers)
├── skills-lock.json
└── .gitignore
```

### Notable config detail

- **Root** `firebase.json` serves `web`, redirects `/` to the Evelve app, and rewrites `/api/waitlist` to Cloud Function `api` (`asia-south1`).
- **`web/firebase.json`** targets site `sapienscampus` with the same waitlist + root rewrite.

GitHub Actions deploy with the **root** Firebase config. The waitlist Cloud Function source is **not** in this repository; production signup expects that function (or an equivalent backend) to be deployed separately.

---

## Getting started

### Prerequisites
- A modern browser (Chrome, Firefox, Safari, Edge)
- [Firebase CLI](https://firebase.google.com/docs/cli) (only if you want to serve/deploy via Firebase)
- Access to Firebase project `sapienscampus-97b6a` (for deploy)

### Run locally (no install)

Open the page directly:

```bash
# macOS / Linux
open web/Evelve/index.html

# Windows
start web/Evelve/index.html
```

Or serve the `web` folder with any static server:

```bash
# Python
cd web && python -m http.server 8080

# Node (if you have npx)
npx --yes serve web -p 8080
```

Then visit `http://localhost:8080` (redirects to `/Evelve/`) or `http://localhost:8080/Evelve/`.

> On `file://`, the quiz and results work fully. Waitlist submit is blocked by design and shows an offline preview message.

### Firebase local serve

```bash
firebase login
firebase use sapienscampus-97b6a
firebase serve --only hosting
```

---

## Deployment

### Automatic (CI)

Pushing to `main` runs `.github/workflows/firebase-hosting-merge.yml` and deploys Hosting live.

Pull requests run `.github/workflows/firebase-hosting-pull-request.yml` for a preview channel.

Both workflows use:
- Project: `sapienscampus-97b6a`
- Secret: `FIREBASE_SERVICE_ACCOUNT_SAPIENSCAMPUS_97B6A`

### Manual

```bash
firebase login
firebase use sapienscampus-97b6a
firebase deploy --only hosting
```

---

## Waitlist API (expected contract)

The front end calls:

```http
POST /api/waitlist
Content-Type: application/json
```

```json
{
  "email": "you@example.com",
  "consent": true,
  "company": "",
  "answers": { "R1": 2, "I1": 1 }
}
```

| Field | Notes |
|-------|--------|
| `email` | Required; client validates format |
| `consent` | Always `true` when submitted from the form |
| `company` | Honeypot — leave empty |
| `answers` | All 30 item scores if the quiz is finished; otherwise `null` |

**Success response** (expected): HTTP 200 with `{ "ok": true, "status": "joined" }`  
**Errors handled in UI**: `400` (invalid email), `429` (rate limit), network/timeout

---

## Privacy

- Quiz answers stay in **this browser tab** (`sessionStorage` key `sapiens-campus-discovery`) until you join the waitlist or clear them with **Start again**.
- Nothing is uploaded until waitlist submit.
- On join (when hosted with the waitlist service), email, consent, and optionally the 30 answers / scores are saved so the product can be shaped with real interest data.
- Users can request deletion of waitlist data at any time (as stated in the form copy).

---

## Design notes

Visual language is a bold, playful campus aesthetic:

- **Fonts**: [Bricolage Grotesque](https://fonts.google.com/specimen/Bricolage+Grotesque) (display) · [DM Sans](https://fonts.google.com/specimen/DM+Sans) (body)
- **Palette**: cream paper, ink outlines, yellow / green / pink / purple / blue accents
- **UI**: hard borders, offset shadows, sticker / window / campus-map metaphors
- Palette direction notes in CSS reference the public CodeSapiens look; layout and interactions are original to this app

---

## Roadmap (product)

| Stage | Status | Intent |
|-------|--------|--------|
| Explore | Live in this repo | Interest discovery |
| Evolve | Planned | Cross-campus peers & learning communities |
| Engineer | Planned | Building real projects together |

---

## License

Proprietary — all rights reserved unless otherwise stated by the repository owner.

---

## Related

- Official RIASEC career-interest research tool: [O\*NET Interest Profiler](https://www.onetcenter.org/IP.html) (for reference only; not used by this app)
