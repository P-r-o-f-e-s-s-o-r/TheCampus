# Sapiens Campus — Explore (Phase 1)

Public site for Sapiens Campus, a non-profit, student-run digital campus across colleges, based in Chennai. This folder is **Explore**. **Evelve** (Phase 2) is not designed yet — every **Join the Campus** button opens `evelve.html`, a coming-soon page.

Plain HTML, CSS, and a little JavaScript. No framework, no compile step, no npm install. Same approach as the rest of `web/`.

## Run locally

From the repo root:

```bash
python3 -m http.server 8080 --directory web/Explore
```

Open [http://localhost:8080](http://localhost:8080).

To serve it the way Firebase Hosting does (the `web` folder is the public root):

```bash
python3 -m http.server 8080 --directory web
```

Then open [http://localhost:8080/Explore/](http://localhost:8080/Explore/).

Any static server works (`npx --yes serve web/Explore`). Opening the HTML files with `file://` also renders the pages. Fonts load from Google Fonts, so they need a network.

## Build

There is nothing to build. The files in this folder are the site.

## Deploy

The repo’s root `firebase.json` publishes the `web` directory to Firebase Hosting (project `sapienscampus-97b6a`). After a hosting deploy, Explore is at `/Explore/`. The root URL `/` still opens `/Evelve/` because that rewrite lives outside this folder.

```bash
firebase login
firebase use sapienscampus-97b6a
firebase deploy --only hosting
```

To host Explore on its own, point any static host at `web/Explore` as the public directory.

Open Graph and canonical URLs in the HTML use `https://sapienscampus-97b6a.web.app/Explore`. Change them if the public domain is different.

## Pages

| File | What it is |
|---|---|
| `index.html` | Home |
| `meetups.html` | Monthly meetups and photos |
| `community.html` | About, partners, sponsors, sponsorship deck |
| `events.html` | Pointer to [eventsapiens.tech](https://eventsapiens.tech) |
| `team.html` | Core contributors |
| `evelve.html` | Phase 2 — coming soon |

Nav is only Home, Meetups, Community, Events, Team, and Join the Campus. Hall of Fame, partners, and sponsors are sections, not nav items.

## Edit the public numbers

`js/constants.js` is the place to change member, event, and college figures. `js/site.js` writes them into the page.

Those counts are **unconfirmed**. They match the old public home (3000+ / 20+ / 50+). The Dec 2025 sponsorship deck printed 2000+ students and 44+ colleges. Don’t invent a replacement — the TODO in `js/constants.js` says the same thing. The HTML repeats the strings so the page still reads if JavaScript is off; update that fallback if you change the file.

The sponsorship deck download is `assets/Sapiens-Campus-Sponsorship-Deck-2026.pdf`.

## Design

Yellove `#ffd966`, ink `#0a0a0a`, cream `#feeec3`, paper `#fefcf5`, muted `#464239`. Headlines are Bricolage Grotesque, body is DM Sans. Thick ink borders, 4px offset shadows, square corners. Each page uses at most two pastels from mint, lilac, and sky.
