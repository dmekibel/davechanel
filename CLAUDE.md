# CLAUDE.md — David Mekibel Portfolio

> Handoff document for continuing the David Mekibel portfolio site in Claude Code.
> Last updated: May 2026

---

## WHO THIS IS FOR

**David Mekibel** — 3D / Motion / AI artist and creative director.
- Russian-Israeli, native English (bilingual), conversational Russian, Hebrew
- Background: Moscow → Anglo-American School Moscow → Emerson College (Boston, VMA) → Tel Aviv / between MOW and TLV
- Runs **Balance Creative**, a multimedia studio (1000+ projects shipped)
- Clients have included Aeroflot, Redmond, Winline, Nature Siberica, and artists like Brezhneva, Bilan, Morgenshtern
- ArtPrize (Michigan) finalist with AI artwork
- AI work on TikTok has hit 4M+ views, 300K+ likes, 80K+ shares; best video 1.7M
- Currently job-hunting for Creative Lead AI/VFX roles (Vertex CGI Dubai-tier studios) AND running Balance Creative AND building exhibition portfolio

The site needs to serve THREE audiences simultaneously:
1. **Galleries / curators** — see him as a contemporary artist
2. **Studios / agencies hiring** — see him as a Creative Lead candidate
3. **Brand clients** — see Balance Creative as a studio to commission

David maintains **separate portfolios, CVs, and contact cards for fine art vs commercial work** — the file system on the desktop reflects that split.

---

## THE CONCEPT

A Windows 98–style desktop as portfolio. The retro UI is the art object: a small, deliberate piece you navigate. Not "another Win95 portfolio" — the chrome, the file system, the apps, all hand-built and considered.

### Aesthetic direction
- **Era:** Inspired by Windows 98 but a *mix* — license to make this its own thing.
- **Color palette:** Period-correct Win98 chrome (gray, teal default wallpaper, navy titlebars). Avoid sky-blue/gold celestial accents — that direction was dropped.
- **Typography:** Tahoma for UI chrome and headings. Pixel fonts (VT323, etc.) reserved for tight accent use, never for the user's name or primary copy.
- **Tone:** Confident, a little funny, art-object energy. Not cosplay.

---

## THE DESKTOP

Top-level desktop icons:

1. **My Computer** — opens an Explorer window containing:
   - 📁 **Fine Art** — gallery-facing folder. Holds the art portfolio, fine-art CV, fine-art contact card. Individual works open in the Image Viewer.
   - 📁 **Commercial Work** — client-facing folder. Holds the commercial portfolio, commercial CV, commercial contact card, **Showreel**, Balance Creative info.
   - 📁 **Documents** — About Me.txt + anything else not categorized.

2. **Paint** — the in-OS Paint app (built).

3. **Image Viewer** — pan/zoom viewer for fine art images. Anti-copy deterrence baked in.

4. **Settings** — wallpaper, screensaver, scale.

5. **Minesweeper** — period-perfect easter egg.

6. **(Optional) Recycle Bin** — Easter egg / rejected work.

**Rule of thumb:** Showreel, Contact, About Me are NOT programs — they're documents/folders inside My Computer.

---

## WINDOW MANAGER REQUIREMENTS

Engineering core. Real, working windows:

- **Drag** by titlebar
- **Resize** from corners/edges (later — v1 can skip if needed)
- **Minimize** to taskbar (taskbar buttons appear, click to restore)
- **Maximize** to fullscreen and back
- **Close** (×)
- **z-index stacking** — clicking a window brings it to front
- **Multiple windows open simultaneously**
- **Mobile fallback:** windows go fullscreen automatically on phones, no dragging

Vanilla JS — no React, no framework.

---

## TECH STACK

- **Single page, vanilla JS, hand-written CSS** — no build step, no framework
- **One `index.html`** loads:
  - `css/reset.css`
  - `css/heaven-os.css` (filename is historical; this is the OS chrome stylesheet — desktop, taskbar, windows, icons)
  - `css/animations.css`
  - `js/main.js` (entry, init, clock, start menu)
  - `js/window-manager.js`, `js/desktop.js`, `js/programs.js`, etc.
- **Assets** in `/assets/`, **fine-art images** in `/content/images/`
- **Hosting:** GitHub Pages

---

## CONTENT IN PROGRESS

David is actively adding fine art images to `content/images/`. These should be:
- Compressed into 3 derivative sizes (thumb / preview / detail) before shipping; originals kept locally only
- Served through the **Image Viewer** app which supports pan + zoom
- Protected with deterrence (no contextmenu, no drag, no `user-select`; canvas-rendered where possible)

---

## HOW DAVID WORKS

- Casual, direct communication. Pushes back when something isn't right (good — listen).
- Strong aesthetic instincts — show options, let him pick, don't over-prescribe.
- Bilingual (EN/RU). The Russian toggle is built; whole-site translation must be instant.
- Avoid em dashes in any final copy meant to look human-written (David's preference for his own writing voice).
- Juggling multiple urgent threads (Vertex application, Balance Creative work, this site) — be efficient with his time.
- Wants edits to apply without per-edit confirmation.

---

## DEPLOYMENT

- Branch for Pages: `main`
- Eventual custom domain: TBD (davechanel.com lapsed; new domain decision pending)

Don't push to production until David sees changes locally and signs off.

---

## PRIOR CONTEXT WORTH KNOWING

- **"Image breeding"** — David's coined term for evolving/cross-pollinating AI outputs across iterations.
- **Madonna / Mnemosyne** — framed AI piece in Michigan, ArtPrize entry.
- References he cares about: Borges, Philip K. Dick, Bataille, early Cronenberg, Soviet propaganda aesthetics, Camille Paglia, El Greco, Francis Bacon.
- Studio aesthetic: high-low collapse, intellectual density meets aesthetic seduction.

Treat the portfolio as a small art object, not a templated dev portfolio. The chrome IS the art.
