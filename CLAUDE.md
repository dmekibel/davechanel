# CLAUDE.md — Heaven OS Portfolio

> Handoff document for continuing the Dave Chanel / David Mekibel portfolio site in Claude Code.
> Last updated: May 2026

---

## WHO THIS IS FOR

**David Mekibel** (publicly: Dave Chanel) — 3D / Motion / AI artist and creative director.
- Runs **Balance Creative**, a multimedia studio (1000+ projects shipped)
- Background: Moscow → Anglo-American School Moscow → Emerson College (Boston, VMA) → Tel Aviv / between MOW and TLV
- Native English (bilingual), conversational Russian, Hebrew
- Clients have included Aeroflot, Redmond, Winline, Nature Siberica, and artists like Brezhneva, Bilan, Morgenshtern
- ArtPrize (Michigan) finalist with AI artwork
- AI work on TikTok has hit 4M+ views, 300K+ likes, 80K+ shares; best video 1.7M
- Currently job-hunting for Creative Lead AI/VFX roles (Vertex CGI Dubai-tier studios) AND running Balance Creative AND building exhibition portfolio

The site needs to serve THREE audiences simultaneously:
1. **Galleries / curators** — see him as a contemporary artist
2. **Studios / agencies hiring** — see him as a Creative Lead candidate
3. **Brand clients** — see Balance Creative as a studio to commission

---

## THE CONCEPT: HEAVEN OS

Not "another Windows 95 portfolio." This is **Heaven Inc.** — a long-running creative project of David's about heaven as a corporate/bureaucratic entity — literalized as the OS of his portfolio. The afterlife runs on Windows 98. God's IT department. The desktop is heaven's desktop.

This is the unifying creative frame. The retro UI isn't just nostalgia — it's an art object that connects to David's broader artistic world (Heaven Inc. TV show concept, etc).

### Aesthetic direction
- **Era:** Inspired by Windows 98 but a *mix* — license to make this our own thing, "Heaven OS"
- **Color palette:** Nostalgic, close to 98 (chunky gray chrome, but allow Heaven-flavored accents — sky blues, gold gate motifs)
- **Typography:** Pixel / 8-bit fonts (W95FA, MS Sans Serif, Tahoma, or comparable web font). Period-correct UI chrome. Body text can stay readable — not trying to be unreadable.
- **Tone:** Confident, a little funny, art-object energy. Not cosplay.

---

## THE ENTRY SEQUENCE

Short, refined, fast. Original concept was gates → clouds → desktop, but it needs to be tight (not 6+ seconds of stalling).

**Target: ~3 seconds total.**

1. "Enter Heaven" button on sky gradient (1s of arrival)
2. Golden gates open in 3D perspective (1s)
3. Quick cloud sweep upward (1s)
4. Desktop arrives

After the first visit, consider skipping the entry on subsequent loads (sessionStorage flag) so the user doesn't fight the animation every time.

---

## THE DESKTOP

Heaven OS desktop with these icons (programs):

1. **My Work** — Project gallery. Opens as a window. Contains TWO subfolders for the dual-audience trick:
   - **Gallery** (artistic / curator-facing): Heaven Inc., Madonna/Mnemosyne, ArtPrize finalist, monk character, personal AI work
   - **Commissioned** (commercial / client-facing): Aeroflot, Redmond, Winline, Nature Siberica, music videos for Brezhneva/Bilan/Morgenshtern, viral TikToks
   Each project opens in its own window with images/video, statement, role, year, link out.

2. **Showreel.mpg** — Opens "Windows Media Player"–style window with embedded reel (Vimeo or YouTube embed). If no single edited reel exists, show 3-4 highlights instead.

3. **About Me.txt** — Opens as Notepad. Plain text bio in David's voice. Date stamp, ASCII divider, the works.

4. **Balance Creative** — Studio folder. Services list, notable client logos, "Hire the studio" CTA with inquiry email. The commercial face.

5. **Contact** — Opens Outlook-compose-style window. Emails, IG, LinkedIn, Behance, Vimeo, Telegram. CV PDF download if available.

6. **(Optional) Recycle Bin** — Easter egg. Old work, rejected concepts. Lighten the mood.

---

## WINDOW MANAGER REQUIREMENTS

This is the engineering core. Real, working windows:

- **Drag** by titlebar
- **Resize** from corners/edges (later — v1 can skip if needed)
- **Minimize** to taskbar (taskbar buttons appear, click to restore)
- **Maximize** to fullscreen and back
- **Close** (×)
- **z-index stacking** — clicking a window brings it to front
- **Multiple windows open simultaneously**
- **Mobile fallback:** windows go fullscreen automatically on phones, no dragging

This should be vanilla JS — no React, no framework. Keeps it fast and the chrome pure.

---

## TECH STACK

- **Single page, vanilla JS, hand-written CSS** — no build step, no framework
- **One `index.html`** that loads:
  - `css/reset.css` (basic normalize)
  - `css/heaven-os.css` (the OS chrome — desktop, taskbar, windows, icons)
  - `css/animations.css` (entry sequence)
  - `js/window-manager.js` (window creation, drag, z-index, minimize/maximize)
  - `js/desktop.js` (icon click handlers, program registry)
  - `js/entry.js` (entry sequence orchestration)
  - `js/main.js` (init, clock, start menu)
- **Assets** in `/assets/` (cloud PNGs, icons, images, project thumbnails)
- **Hosting:** GitHub Pages (free), eventually pointed at davechanel.com again once domain is re-purchased

---

## WHAT WAS THERE BEFORE (legacy state)

David built an earlier version that stalled. Notes:

- An old `index.html` exists but has been corrupted (Pandoc-style `:::` divs and escaped JS) — **do not try to salvage it**, treat it as historical reference only
- `dave_project_master_export.txt` contains the last working version inlined — useful as reference for the entry sequence CSS, cloud animation, and overall structure
- A `CNAME` file with `davechanel.com` was in the repo — meaning a GitHub Pages deployment existed
- The old domain davechanel.com is currently dead (likely expired)
- David has a working GitHub account and access to the old repo
- Cloud asset PNGs (Layer 2/3/4.png at specific dimensions) were referenced but may need to be re-sourced or replaced

**Recommendation:** Start fresh in a clean folder structure. Reference the old code only for the cloud animation timing and gate transform values, both of which were decent.

---

## CONTENT STILL NEEDED FROM DAVID

Before content can be filled in, ask David for:

1. **About Me.txt body** — bio in his voice
2. **Gallery projects** (3-6 best art pieces): title, year, medium/tools, 1-2 sentence statement, image, exhibition history
3. **Commissioned projects** (3-8 best client works): client, project, year, role, deliverable description, link, notable stats
4. **Showreel link** — if no edited reel exists, pick 3-4 standout pieces
5. **Balance Creative one-liner** — already drafted from past LinkedIn work, can pull from prior conversations
6. **Contact info** — which emails / socials he wants public
7. **Domain decision** — going with `username.github.io/repo-name` first, davechanel.com once re-purchased

David explicitly said NO placeholder content — wants real content from the start.

---

## HOW DAVID WORKS

- Casual, direct communication. Pushes back when something isn't right (good — listen).
- Has strong aesthetic instincts — show options, let him pick, don't over-prescribe
- Bilingual (EN/RU) — site is English-primary, but he may want a Russian toggle later (don't build it yet, just keep i18n possible)
- Avoid em dashes in any final copy meant to look human-written (David's preference for his own writing voice)
- He's juggling multiple urgent threads (Vertex application, Balance Creative work, this site) — be efficient with his time

---

## BUILD ORDER (suggested)

1. Clean folder structure + empty file scaffolding
2. CSS chrome — desktop, taskbar, one example window, icons (no JS yet)
3. Window manager JS — drag, z-index, minimize/maximize, close, taskbar
4. Entry sequence — gates + clouds + desktop reveal
5. Program registry — wire each desktop icon to open its window
6. Fill in real content from David (one window at a time)
7. Mobile responsive pass — windows go fullscreen, taskbar adjusts
8. Polish: sound effects (optional, 98 startup chime?), easter eggs, performance
9. Deploy to GitHub Pages

After each major step, RUN A LOCAL SERVER (`python3 -m http.server` or `npx serve`) and let David see it in his browser before moving on.

---

## DEPLOYMENT

- Repo: existing GitHub repo (David to confirm name) or new one
- Branch for Pages: `main` (or `gh-pages` if separate)
- First live URL: `https://[username].github.io/[repo-name]/`
- Eventually: `davechanel.com` (after domain re-purchase + CNAME setup)

Don't push to production until David sees it locally and signs off.

---

## PRIOR CONTEXT WORTH KNOWING

David has a deep creative vocabulary that should be respected:
- **"Image breeding"** — his coined term for evolving/cross-pollinating AI outputs across iterations
- **Heaven Inc.** — his ongoing TV show concept; major creative project
- **Madonna / Mnemosyne** — framed AI piece in Michigan, ArtPrize entry
- References he cares about: Borges, Philip K. Dick, Bataille, early Cronenberg, Soviet propaganda aesthetics, Camille Paglia, El Greco, Francis Bacon
- Studio aesthetic: high-low collapse, intellectual density meets aesthetic seduction

Treat the portfolio as a small art object, not a templated dev portfolio. The chrome IS the art.
