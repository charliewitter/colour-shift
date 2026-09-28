# Colour Shift: App Spec

How Colour Shift is built and how it behaves. Companions: `SPEC.md` (what and why, in plain language) and `COLOUR-SHIFT-STYLE-GUIDE.md` (look and motion).

Reference project: `../color-shift` (by MDS). Use it for reference only; don't copy code.

---

## Build

A single-page web app for finding new colour pairings. It shows random Unsplash photos, extracts a background/text pair from each one, scores the pair's contrast, and lets you fine-tune, share, and export it.

**Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind v4 (config in `globals.css`), pnpm. Colour libraries: culori (conversions), apca-w3 (APCA), node-vibrant (palette extraction), opentype.js (specimen fonts).

**Hosting:** Vercel, at the site root. `UNSPLASH_ACCESS_KEY` in `.env.local` locally and in Vercel env vars.

**Build order.** One step at a time; plan, get approval, build, check in the browser, commit.

0. Project setup: app shell, tokens, empty layout
1. Two colours and a contrast score
2. Sliders and colour modes
3. Unsplash photos and palette extraction
4. Sample text and fonts
5. Copy, share link, export
6. Mobile layout
7. Motion polish
8. Deploy to Vercel

---

## Content

**Desktop (640px and wider).** Figma is the visual source of truth: [Colour Shift](https://www.figma.com/design/IFKpGTC3reLa2GWP6go6KH/Colour-Shift?node-id=0-1). Its layer names are listed under the diagram.
```
┌──────────────────────┬──────────────────────┐
│ [FONT ▾]             │                      │
│   Colour panel       │   Photo panel        │
│   bg colour +        │   Unsplash photo,    │
│   sample text in     │   arrows on hover,   │
│   fg colour          │   credit bottom-right│
├──────────────────────┴──────────────────────┤
│ Slider panel (opens upward, pushes stage up)│
│ OKLCH HSB RGB              [channel readout]│
│ ━━━━━━━━━━━━━━━━━━━━●━━━━━━━━━━━━━━━━━━━━━━ │
│ ━━━━━━━━━━━━━━━━━━━━●━━━━━━━━━━━━━━━━━━━━━━ │
│ ━━━━━━━━━━━━━━━━━━━━●━━━━━━━━━━━━━━━━━━━━━━ │
├─────────────────────────────────────────────┤
│ ■FG ⇄ ■BG   WCAG|APCA  score   ← → EXPORT   │
└─────────────────────────────────────────────┘
```
Figma names: `stage` (colour panel + photo panel), `slider panel`, `dock` (`panel=none|score|export`), `colour selectors`, `a11y module`, `export`, `font dropdown`, `font menu`, `channel readout`.

**Mobile (narrower than 640px).** Not designed yet; this is a placeholder. Designs come after desktop.
```
┌──────────────────────┐
│ [score]     [EXPORT] │
├──────────────────────┤
│   Colour panel       │
├──────────────────────┤
│   Photo panel        │
├──────────────────────┤
│ [FG]   [⇄]    [BG]   │
└──────────────────────┘
```

**On screen:**
- **Colour panel:** background colour, with editable sample text in the fg colour. Starts as "Aa"; empty text shows "Aa". Font dropdown top-left.
- **Photo panel:** current photo, previous/next arrows on hover, and the photographer credit linking to Unsplash.
- **Dock:** fg picker (swatch + hex), swap button, bg picker (swatch + hex) · WCAG/APCA switch, threshold levels (when open), score · ← → photo arrows (same as the photo-panel arrows), EXPORT. No FG/BG labels.
- **Slider panel:** OKLCH / HSB / RGB tabs, channel readout, three sliders. No CLOSE button.
- **Export (in dock):** COPY URL, DOWNLOAD .MD, CLOSE.

**Contrast grades.** Each level is a threshold button (WCAG `1.5 3.0 4.5 7.0`, APCA `30 45 60 75 90`).

| WCAG 2 (ratio) | Grade |
|---|---|
| ≥ 7.0 | AAA |
| ≥ 4.5 | AA |
| ≥ 3.0 | AA Large |
| ≥ 1.5 | Display (bare minimum: huge display/marketing text, unselected states) |
| < 1.5 | Fail |

| APCA (Lc, absolute) | Grade |
|---|---|
| ≥ 90 | Body+ (preferred body text) |
| ≥ 75 | Body |
| ≥ 60 | Content |
| ≥ 45 | Headlines |
| ≥ 30 | Spot |
| < 30 | Fail |

The score shows the grade and the value, taken from the contrast check: `AA 5.21:1` or `Content Lc 64.3`. Mixed case on purpose (data, not a label). The Figma mockup values are illustrative, not accurate; the build uses real scores.

**Exports**
- **Share URL:** `/?photo=<id>&bg=<hex>&fg=<hex>&algo=wcag|apca&swap=1&text=<text>`
- **Markdown file:** both colours (hex, RGB, OKLCH), score and grade for the active method, share URL, photo credit.

---

## Constraints

- One page. No routes besides `/` and the photo API.
- **All state lives in one top-level client component.** No state library, no context.
- **All colour math lives in `src/lib/color-engine.ts`:** conversions, contrast, thresholds, gamut limits, export text.
- **Small, reusable UI pieces** go in `src/components/ui/` (button, swatch, score, slider). Layouts combine them; they aren't edited for layout tweaks.
- **The Unsplash key stays on the server.** The browser only talks to `/api/photos`.
- **Unsplash rules:** credit every photo, link back with `utm_source=colour_shift&utm_medium=referral`, trigger the download-tracking endpoint when a photo is used.
- **Next.js 16 differs from training data:** read `node_modules/next/dist/docs/` before writing Next-specific code.
- `pnpm lint` and `pnpm build` pass before every commit.

---

## Style

Full detail is in `COLOUR-SHIFT-STYLE-GUIDE.md`. The essentials:

- Dark, quiet chrome. Only the pair and the photo carry colour.
- Tokens in `globals.css`; no raw hex in components.
- Input Mono, 12px, uppercase labels. 4px radius.
- CSS-only motion. Vertical only on mobile. Respect reduced motion.

---

## Behavior

**Photos**
- `GET /api/photos?count=N` pulls random photos from a shuffled pool of ~40 varied search words (nature, neon, fog, food, graffiti…). Plain "random" returns too narrow a set.
- `GET /api/photos?id=<id>` fetches one photo, for share links.
- A small buffer of upcoming photos is preloaded, and their palettes are extracted ahead of time.
- A tiny blurred/pixelated preview shows first, then the full photo.
- Changing photo: the photo slides while the colours crossfade at the same time.

**Pairing**
- Prefer a vivid, dramatic pair over muted averages.
- Default: darker colour as background. Swap flips it.

**Controls**
- The slider panel only shows when fg or bg is selected. Tap fg or bg → it opens for that colour, and that picker shows its `active` state so it's clear which colour is being edited. Tap the other one → the panel switches colour and stays open. Tap the same one again → closes.
- Switching slider mode doesn't change the colour at all.
- OKLCH chroma is capped at the maximum in-gamut value for the current lightness and hue.
- Channel readout (e.g. `SATURATION 56.5`) is hidden by default. It shows while a slider is being dragged or keyboard-adjusted, updates live, and fades out ~1s after release.
- Tap the score text → threshold levels open or close.
- The highlighted level is the highest one the pair currently passes. Clicking any level moves the edited colour until the pair just reaches that level (up or down), so every level is one click away. If no colour is selected, the text (fg) colour moves.
- Tap EXPORT → export options. After an action, the label briefly confirms (`COPY URL` → `COPIED URL`).
- The slider panel, score levels and export can all be open at the same time.
- The clipboard falls back to an older method when the modern API is blocked.

**Share links**
- Opening a share URL restores the photo, colours, contrast method, swap state and sample text, then fills the buffer with random photos.

**Keyboard**
- ← → : previous / next photo (same as both sets of on-screen arrows). Ignored while editing text.
- Space: jump to a new random photo, inserted after the current one so ← still goes back. Ignored while editing text.
- Esc: close any open panel

---

## Avoid

Specific to this project. Each item is a trap MDS's repo shows, or a scope decision already made.

- **GSAP and animation libraries.** MDS's GSAP control bar is his most fragile code. Use CSS only.
- **Copying MDS's code.** Read it for reference, then write fresh.
- **Leftover experiments.** Delete abandoned components instead of keeping them. His repo carries about 2,000 lines of unused code (`control-strip.tsx`, `controls.tsx`, `morph-test.tsx`).
- **Stale docs.** Update `CLAUDE.md` in the same commit as the change it describes. His drifted (wrong file sizes, finished work listed as active).
- **Building ahead.** Only the current build step, even if a later step looks easy.
- **Out-of-scope features:** embed mode, display mode, social preview images, photo uploads, theme search, saved collections, history.
- **Shift Nudge wiring:** base path, `shift_nudge` UTM tags, embed messaging, Shift Nudge favicon, the hard-coded LAN IP in `next.config.ts`.
- **Raw hex in components.** Use the style-guide tokens.
- **Colour math outside `color-engine.ts`.**
- **Horizontal motion on mobile.**
- **Exposing the Unsplash key:** never in client code, logs, commits, or `NEXT_PUBLIC_` variables.
