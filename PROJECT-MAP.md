# Colour Shift: Project Map

The whole web app on one page: what each part is, where it lives, how the parts connect, and why they're built that way. Written 2026-10-05, after step 8 (deploy).

**How this fits with the other docs.** `SPEC.md` says what and why, `APP-SPEC.md` gives the build rules and behaviour, `COLOUR-SHIFT-STYLE-GUIDE.md` covers look and motion, `CONTEXT.md` is the glossary, `docs/adr/` holds the decisions and `docs/LOG.md` the history. `CLAUDE.md` has the short architecture notes an agent needs up front. This map is the detailed reference behind all of them, arranged by where things are in the code.

**When this map and the code disagree.** The code is the source of truth for *how* things are implemented. This map is the source of truth for the *invariants* it states (§1.2, §19): the rules the code must keep. If code contradicts a description (a file name, a constant, a size), fix the map. If code contradicts an invariant (say, a level click that moves an anchor), treat it as a possible bug and check with the owner before changing either.

**Keeping it current.** Update this file in the same commit as any change to structure, state, the engine, the API or a decision. Code is referred to by file and function name rather than line number, so small edits don't make it stale.

---

## Contents

0. [Before you start](#before-you-start): the screen, terms, names and history
1. [At a glance](#1-at-a-glance): mental model, core invariants, where to change things
2. [Repository layout](#2-repository-layout)
3. [Runtime architecture](#3-runtime-architecture)
4. [Runtime state and data flow](#4-runtime-state-and-data-flow)
5. [Actions: what each input does](#5-actions-what-each-input-does)
6. [Colour engine](#6-colour-engine)
7. [Back end: `/api/photos`](#7-back-end-apiphotos)
8. [Photo pipeline (browser side)](#8-photo-pipeline-browser-side)
9. [Share links](#9-share-links)
10. [Export and share](#10-export-and-share)
11. [Components](#11-components)
12. [Desktop vs mobile](#12-desktop-vs-mobile)
13. [Accessibility and keyboard](#13-accessibility-and-keyboard)
14. [Fonts](#14-fonts)
15. [Design tokens](#15-design-tokens)
16. [Motion](#16-motion)
17. [Build, tooling and deploy](#17-build-tooling-and-deploy)
18. [Decisions](#18-decisions)
19. [Constraints and rules](#19-constraints-and-rules)
20. [Out of scope](#20-out-of-scope)
21. [Known gaps](#21-known-gaps)
22. [Known quirks and tech debt](#22-known-quirks-and-tech-debt)
23. [Documentation drift log](#23-documentation-drift-log)
24. [What's next](#24-whats-next)

---

## Before you start

New to this repo? Read this section, then §1. The full glossary is `CONTEXT.md`; the terms below are the ones this map uses before explaining them.

### The screen

Desktop (640px and wider):

```
┌───────────────────────────┬───────────────────────────┐
│ [FONT ▾]                  │                           │
│        COLOUR PANEL       │        PHOTO PANEL        │  ← the stage
│   background colour, with │   Unsplash photo; ← → on  │
│   the sample text "Aa" in │   hover; credit bottom-   │
│   the text colour         │   right                   │
├───────────────────────────┴───────────────────────────┤
│ SLIDER PANEL (only while a colour is selected)        │
│ OKLCH  HSB  RGB                    [channel readout]  │
│ ━━━━━━━━━━━━━━━━●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━●━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ ━━━━━━━━━━━●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
├───────────────────────────────────────────────────────┤
│ ■#HEX ⇄ ■#HEX   WCAG|APCA │ [levels] AA 5.21:1  ← → EXPORT │  ← the dock
└───────────────────────────────────────────────────────┘
```

Mobile (narrower than 640px): the same parts stacked, top to bottom: colour panel, photo panel, slider panel (when open), then the **bottom bar** (a row of big colour blocks with swap between them, the levels when open, then WCAG|APCA, the score and a share button). Fuller sketches: APP-SPEC "Content"; the visual source of truth is Figma.

### Terms

| Term | Means |
|---|---|
| **Pair** | A text colour + a background colour. "The pair" = the one on screen (§6.1). |
| **Text colour / background colour** | The two colours of the pair. In code: `Role` = `"text"` / `"bg"`. |
| **Active colour** | Whichever colour is selected for editing (or none). Selecting one opens the slider panel. It follows its value through a swap: if the text colour is active and you swap, that same colour, now the background, stays active. |
| **Anchor** | Each colour as it was last *set* (by a slider, a swap, or a photo's pair). Level clicks start from the anchor so repeated clicks don't wash the colour out (ADR 0005). |
| **Contrast method** | WCAG 2 or APCA: the two standards for scoring contrast. |
| **Score** | The pair's contrast under the current method, with its grade: `AA 5.21:1`, `Content Lc -64.3`. |
| **Lc** | APCA's contrast number ("lightness contrast"), roughly −108 to +106. Its sign says which way round: negative = light text on dark. |
| **Grade / level / passing level** | A grade is a named band (AA, Body…). A level is the threshold where a grade starts (WCAG 4.5, APCA 60…), shown as a button. The passing level is the highest one the pair meets, highlighted. Clicking a level moves a colour until the pair just reaches it. |
| **Colour mode / channel** | The model the sliders edit in (OKLCH, HSB, RGB) and its three values (one slider each). |
| **Photo colour / photo's pair** | The ~6 colours node-vibrant finds in a photo; the pair `pickPair` chooses from them. |
| **Photo stream** | The list of photos you move through with ← →, including ones loaded ahead. |
| **Stage, colour panel, photo panel** | The main area; its left half (the pair + sample text) and right half (the photo). |
| **Dock / bottom bar / swatch row** | The control bar at the bottom: desktop / mobile / the mobile bar's row of colour blocks. |
| **Specimen font** | The font the sample text is set in (one of seven). |
| **Colour fade** | How a colour change animates: slow for a new photo's pair (`"photo"`), quick for swap or a level (`"step"`), instant for slider drags (`"none"`). |
| **Roll** | The score and hex values changing character by character, like a ticker. |
| **Chrome** | The app's own interface (bars, buttons, panels), as opposed to the user's colours and the photo. Not the browser. |
| **Visual-only state** | State that only affects how something animates or looks for a moment (a photo sliding out, a "COPIED" label), so it lives in that component instead of `ColorShift`. |

### Names and history

| Name | Means |
|---|---|
| **The owner** | The one person this is built by and for. |
| **MDS** | The designer whose app *Color Shift* inspired this one. His repo sits next to this one at `../color-shift`, as reference only: the look and stack follow it, but no code was copied. |
| **Shift Nudge** | The design course site MDS's version runs inside. Its wiring (base path, tracking tags, embed messaging) was deliberately left out. |
| **Build steps 0–8** | The order the app was built in (SPEC.md): 0 setup, 1 two colours + score, 2 sliders + levels, 3 photos, 4 sample text + fonts, 5 share + export, 6 mobile, 7 motion polish, 8 deploy. All done. |
| **The LOG** | `docs/LOG.md`: one entry per session, newest first. "From the log" = the reason is recorded there. |
| **ADR 000N** | A decision record in `docs/adr/` (§18.1). |
| **DialKit, Agentation** | Developer tools used during steps 6–7 to tune animation values live and leave notes on the UI. Removed at step 8; their tuned values are now plain constants. |
| **Figma** | The design file. Its layer names use the same terms as this map. |
| **imgix** | The image service behind Unsplash's photo URLs. It resizes a photo from parameters in its URL (`w=1600`). |
| **ƒ** | The mark Next.js's build output puts beside a page that's rendered per request instead of once at build time. |
| **react-hooks 7** | Version 7 of the ESLint plugin for React hooks (a lint rule set, not React itself). |
| **Demo key** | Unsplash's starter access key: 50 requests/hour until production access is approved. |
| **Production access** | Unsplash's approval for a live app: a much higher hourly limit. Applied for with the live URL and screenshots. |
| **`duat3`** | The Vercel team (account) the project lives under. |
| **Secret** | A Vercel environment variable stored so it can't be read back, only replaced. |
| **`mWeb`** | The Figma section holding the mobile web designs. |
| **Claude's `!`** | In Claude Code, a line starting with `!` runs as a shell command in the session. Long-running ones get moved to the background, which is why `pnpm dev` runs in its own Terminal. |

---

## 1. At a glance

| | |
|---|---|
| **What** | One-page tool for finding colour pairings. Random Unsplash photos each suggest a text colour and a background colour; the pair is scored for contrast (WCAG 2 or APCA), fine-tuned with sliders (OKLCH / HSB / RGB), and kept as a share link or a Markdown file. |
| **Who for** | The owner's own design inspiration. Building it is also how the owner is learning the Claude workflow. |
| **Live** | https://colour-shift.vercel.app (Vercel, site root, no base path, no custom domain) |
| **Stack** | Next.js 16.3.7 (App Router), React 19.2.8, TypeScript 5 (strict), Tailwind v4 (config in CSS), pnpm 12.6.0 |
| **Colour libraries** | `culori` 4 (conversions, gamut, WCAG), `apca-w3` 0.1.9 (APCA), `node-vibrant` 4 (palette extraction, browser build) |
| **Server code** | One route handler, `src/app/api/photos/route.ts`: an Unsplash proxy so the access key never reaches the browser |
| **State** | All of it in one client component, `src/components/color-shift.tsx`. No state library, no context. |
| **Colour math** | All of it in `src/lib/color-engine.ts` |
| **Size** | ~2,550 lines across 30 files in `src/` (largest: `color-shift.tsx` 387, `color-engine.ts` 321) |
| **Tests** | None (see §21) |
| **Design source** | [Figma: Colour Shift](https://www.figma.com/design/IFKpGTC3reLa2GWP6go6KH/Colour-Shift?node-id=0-1): desktop frames, plus the `mWeb` section for mobile. Wins over the style guide (ADR 0001). |
| **Reference** | `../color-shift` (by MDS). Reference only; no code copied. |
| **Status** | Build steps 0–7 done. Step 8 (deploy) is live but not closed: it waits on Unsplash production access (the demo key allows 50 requests/hour) and the owner's browser check (§24). |

### 1.1 Mental model

Colour Shift is five parts:

1. **Photo source.** `/api/photos` gets random Unsplash photos without exposing the key (§7).
2. **Pair picker.** The browser extracts each photo's palette (node-vibrant) and `pickPair` chooses a text and background colour (§6.7, §8).
3. **Colour editor.** `ColorShift` holds the pair on screen, its anchors, the contrast method and all UI state; sliders, swap and levels change the pair (§4, §5).
4. **Presentation.** `Stage` shows the pair and the photo; `Dock` (desktop) and `BottomBar` (mobile) show the same state as two layouts (§11, §12).
5. **Keeping a pair.** Share links and Markdown files record the pair on screen (§9, §10).

The main flow:

```
photo ─► palette ─► photo's pair ─► pair on screen ─► score / edit ─► share link / Markdown
         (browser)   (pickPair)      (colors)         (engine)
```

Two single sources of truth: **state** lives in `src/components/color-shift.tsx`; **colour math** lives in `src/lib/color-engine.ts`.

### 1.2 Core invariants

Rules the code must keep. Read these before changing anything. Breaking one is a bug unless the owner agrees to change the rule (and this list, and any ADR it cites).

**State**
- `ColorShift` owns all app state. No context, no state library. Leaf components hold only visual-only state (a leaving photo, a rolling label, a confirmation timer).
- `colors` is the pair on screen. `anchors` is each colour as last *set* (by a slider edit, swap, a photo's pair or the fallback pair).
- Anything that sets a colour writes **both** `colors` and `anchors`: a slider edit, swap, a photo's pair, the fallback pair. The one exception: colours from a share link survive the first photo shown (`keepSharedColors`, §9.3).
- Level clicks **read** the anchor and write `colors` only. They never touch `anchors` (ADR 0005).
- Changing the colour mode never changes a colour.
- The active colour follows its value through a swap.

**Colour**
- All colour math is in `color-engine.ts`.
- Scores, grades, share links and Markdown all use the **displayed hex** (after gamut clamping), never the internal culori object.
- The score never rounds up (truncates); grades use the real value; APCA grades use `|Lc|`.
- OKLCH chroma never exceeds what sRGB can show at that lightness and hue.

**Photos and Unsplash**
- The Unsplash key exists only on the server. The browser talks only to `/api/photos` (plus Unsplash's image CDN for the images themselves).
- Palette extraction happens in the browser, on the 200px copy.
- Every photo shown is credited, with UTM links, and its download tracking fires once, when it's first shown (not when it's loaded ahead).
- At most one random-photo request is in flight.

**Presentation**
- Desktop and mobile share the same state and callbacks; only the layout differs. Both bars are always rendered and CSS picks one.
- The app's own interface ("chrome": bars, buttons, panels) uses design tokens only, never raw colour values. Inline style colours are only for values that are state, like the pair (§11.4).
- Motion is CSS only. Under reduced motion, animations are 1ms (not `none`) so end events still fire.
- The address bar is never updated; share links are built only when asked for.

**Repo**
- Licensed fonts are never committed or uploaded (ADR 0002).
- `AGENTS.md` stays.

### 1.3 Where to change things

| To change… | Start in | Also read |
|---|---|---|
| Any state, or what an input does | `components/color-shift.tsx` | §4, §5, §1.2 |
| Colour conversions, channels, gamut | `lib/color-engine.ts` (`CHANNELS`, `setChannel`, `maxChroma`) | §6.2–6.4 |
| Contrast, grades, level thresholds | `lib/color-engine.ts` (`getContrast`, `LEVELS`, `GRADES`) | §6.5, APP-SPEC, ADR 0004 |
| What a level click does | `reachLevel` in `color-engine.ts`; `chooseLevel` in `color-shift.tsx` | §6.6, ADR 0005 |
| How a pair is picked from a photo | `pickPair` in `color-engine.ts` (`VIVID_WEIGHT`); `extractPair` in `lib/photos.ts` | §6.7, §8.2 |
| Which photos arrive (search words, batch limit) | `app/api/photos/route.ts` (`SEARCH_WORDS`, `MAX_COUNT`) | §7 |
| Buffer size, ← → and Space behaviour | `color-shift.tsx` (`PHOTO_BATCH`, `PHOTOS_AHEAD`, `nextPhoto`, `jumpPhoto`) | §5, §8.3, §7.6 (API budget) |
| Photo sizes | `lib/photos.ts` (`DISPLAY_WIDTH`, `EXTRACT_WIDTH`) | §8.1 |
| Photo slide, preview, credit, arrows | `components/photo-panel.tsx` | §11.2, §16 |
| Share link format or validation | `lib/share.ts` | §9 |
| Markdown file contents | `exportMarkdown` in `color-engine.ts` | §6.8 |
| Clipboard, download, share sheet | `lib/export.ts`; `ExportControls` in `dock.tsx` | §10, ADR 0006 |
| Desktop bar | `components/dock.tsx` | §11.2, §12 |
| Mobile bar | `components/bottom-bar.tsx` | §11.2, §12 |
| A shared control's look or behaviour | `components/ui/*` (layouts don't edit these) | §11.3, style guide |
| Sample text editing or fitting | `components/sample-text.tsx` | §11.2 |
| Keyboard shortcuts | `onKeyDown` in `color-shift.tsx` | §13 |
| Specimen fonts | `lib/fonts.ts` + `app/layout.tsx` (Google) + `globals.css` (`@font-face`) | §14, ADR 0002 |
| Colours of the chrome | `globals.css` (`:root` tokens + `@theme inline`) | §15, style guide |
| Motion timings | `globals.css` keyframes, `COLOR_FADE_MS`, `ROLL_*_MS` | §16, style guide (change both) |
| Env vars, deploy, ignored files | Vercel project, `.gitignore`, `.vercelignore` | §17 |
| A hard-to-reverse decision | new ADR in `docs/adr/` | §18 |
| A term | `CONTEXT.md` | |

---

## 2. Repository layout

Every committed file, with what it's for. Line counts show rough size only (as of 2026-10-05); nothing else in this map refers to line numbers.

```
colour-shift/
├── AGENTS.md                    Next.js agent rules block. `next dev` writes it here; must stay, or it lands in CLAUDE.md
├── APP-SPEC.md                  Build rules and behaviour
├── CLAUDE.md                    Agent instructions: workflow, teaching, stack, short architecture notes
├── COLOUR-SHIFT-STYLE-GUIDE.md  Look and motion: tokens, type, shape, states, motion timings
├── CONTEXT.md                   Glossary. Use its terms in docs and code
├── PROJECT-MAP.md               This file
├── README.md                    Public intro, local setup, font note
├── SPEC.md                      What and why; build order and status
├── docs/
│   ├── LOG.md                   Progress log, newest first; top entry = latest handoff
│   └── adr/                     Decisions (0001–0006), see §18
├── public/
│   ├── fonts/                   Gitignored except DepartureMono-* (see §14)
│   │   ├── DepartureMono-Regular.woff2   committed (SIL OFL)
│   │   ├── DepartureMono-LICENSE.txt     committed
│   │   └── InputMono-*.ttf      local only, never committed or uploaded
│   └── icons/                   SVGs exported from Figma (committed):
│                                arrow-left, arrow-right, chevron-down, repeat (swap), share
├── src/
│   ├── app/
│   │   ├── api/photos/route.ts  (94)  Unsplash proxy: ?count, ?id, ?download
│   │   ├── apple-icon.tsx       (17)  180px home-screen PNG via next/og ImageResponse (placeholder)
│   │   ├── globals.css          (206) Tailwind import, @font-face, tokens, @theme mapping, keyframes, reduced motion, base styles
│   │   ├── icon.svg                   Favicon placeholder: colour panel beside photo panel
│   │   ├── layout.tsx           (40)  Root layout: metadata, viewport-fit=cover, Google fonts as CSS variables, lang en-GB
│   │   └── page.tsx             (8)   Reads share-link searchParams on the server → <ColorShift shared>. Makes / dynamic
│   ├── components/
│   │   ├── color-shift.tsx      (387) The app. All state, effects, keyboard, actions
│   │   ├── stage.tsx            (76)  Colour panel (font dropdown + sample text) beside photo panel
│   │   ├── sample-text.tsx      (110) Editable sample text, shrink to fit
│   │   ├── photo-panel.tsx      (138) Photo layers (leaving + current), preview, credit, arrows
│   │   ├── slider-panel.tsx     (104) Colour mode tabs, channel readout, three sliders
│   │   ├── dock.tsx             (206) Desktop bar. Also exports ExportControls (used by bottom-bar too)
│   │   ├── bottom-bar.tsx       (178) Mobile bar: swatch row, levels, method switch, score, share
│   │   └── ui/                        Small reusable pieces (see §11)
│   │       ├── button.tsx       (28)
│   │       ├── color-picker.tsx (27)
│   │       ├── dropdown.tsx     (106)
│   │       ├── levels.tsx       (39)
│   │       ├── reveal.tsx       (22)
│   │       ├── roll-text.tsx    (72)
│   │       ├── score.tsx        (23)
│   │       ├── segmented-control.tsx (39)
│   │       ├── slider.tsx       (66)
│   │       └── swatch.tsx       (10)
│   ├── lib/
│   │   ├── color-engine.ts      (321) All colour math (see §6)
│   │   ├── export.ts            (58)  Clipboard (with fallback), file download, native share sheet
│   │   ├── fonts.ts             (22)  The seven specimen fonts
│   │   ├── photos.ts            (63)  /api/photos calls, Unsplash URL sizing, preload, tracking, extractPair
│   │   └── share.ts             (66)  Share link: build (shareQuery) and parse (parseShare)
│   └── types/
│       ├── apca-w3.d.ts         (7)   Hand-written types (apca-w3 ships none)
│       └── photo.ts             (11)  Photo: what /api/photos returns
├── eslint.config.mjs            next core-web-vitals + typescript configs
├── next.config.ts               allowedDevOrigins (LAN phones can use `pnpm dev`)
├── package.json                 Scripts: dev, build, start, lint. packageManager pins pnpm 12.6.0
├── pnpm-workspace.yaml          allowBuilds: which packages may run install scripts (sharp, unrs-resolver: no).
│                                minimumReleaseAgeExclude: pnpm only installs releases older than a minimum age; Next 16.3.7's packages are exempt
├── postcss.config.mjs           @tailwindcss/postcss
├── tsconfig.json                strict, bundler resolution, `@/*` → `src/*`
├── .gitignore                   secrets, build output, .vercel, licensed fonts (public/fonts/* except DepartureMono-*)
└── .vercelignore                licensed fonts, .env*, .next, node_modules kept out of `vercel deploy` uploads
```

**Not committed, but present locally:** `.env.local` (holds `UNSPLASH_ACCESS_KEY`; never print or commit), `.vercel/project.json` (project link to `duat3/colour-shift`), `.next/`, `node_modules/`, `public/fonts/InputMono-*.ttf`.

**Import alias:** `@/` = `src/`.

**Dependency direction** (nothing points back up):

```
app/page.tsx ──► components/color-shift.tsx ──► components/* ──► components/ui/*
                        │                            │
                        └──────────► lib/* ◄─────────┘
                                      │
                 lib/color-engine.ts ◄┴ (share, photos and components all ask the engine)
app/api/photos/route.ts ──► types/photo.ts   (server only; no lib/ imports)
```

---

## 3. Runtime architecture

```
          Browser                              Vercel (server)                        Unsplash
┌──────────────────────────────┐   ┌──────────────────────────────────────┐   ┌──────────────────────┐
│                              │   │ page.tsx  (on each request to /)     │   │                      │
│  first HTML ◄───────────────────── parseShare(searchParams)             │   │                      │
│                              │   │   → renders <ColorShift shared>      │   │                      │
│ ColorShift (all state)       │   │                                      │   │                      │
│   lib/photos.ts ── fetch ───────► │ GET /api/photos  (holds the key)     │   │ api.unsplash.com     │
│                              │   │   ?count=N → N × /photos/random ───────► │                      │
│                              │   │   ?id=X    → /photos/X ────────────────► │                      │
│                              │   │   ?download=X → /photos/X/download ────► │                      │
│                              │   └──────────────────────────────────────┘   │                      │
│   <img> full photo, 1600px ─────────────────────────────────────────────────► images CDN (imgix)   │
│   node-vibrant, 200px copy ─────────────────────────────────────────────────► images CDN (imgix)   │
│   color-engine: pickPair,    │                                              │                      │
│   contrast, sliders          │                                              │                      │
└──────────────────────────────┘                                              └──────────────────────┘
```

- **Server render.** `page.tsx` is an async server component. It awaits `searchParams`, validates them with `parseShare`, and passes plain strings (hex, ids) to the client component. Reading `searchParams` makes `/` render per request (shown as ƒ in Next's build output) instead of at build time. This is why a share link paints its colours in the first HTML with no flash of defaults.
- **Client app.** Everything else runs in the browser. `ColorShift` holds all state and passes values and callbacks down.
- **The only server code** is `/api/photos`. It's a thin proxy: no database, no cache (`cache: "no-store"` on every Unsplash call), no auth.
- **Images go straight to Unsplash's CDN** (imgix), not through Vercel. Sizes come from URL parameters. `next/image` is not used for photos (it is used for the small UI icons).
- **Palette extraction happens in the browser**, on a 200px copy of each photo, so the server never touches image data.
- **Other routes:** `icon.svg` and `apple-icon` are Next metadata routes (favicon and the 180px home-screen PNG). There's no other page.

---

## 4. Runtime state and data flow

All in `ColorShift` (`src/components/color-shift.tsx`). "Visual-only" state that never matters to the rest of the app lives in leaf components (§11), never here.

### 4.1 How the colour state connects

The hardest part of the state is how `colors`, `anchors`, `pairs` and the share-link flags relate. Three pictures, all from `color-shift.tsx`.

**Where the pair on screen comes from.** Every source on the left writes `colors` *and* `anchors`; a level click is the only thing that writes `colors` alone.

```
  SETS a colour (writes both)                        DERIVES (writes colors only)
  ───────────────────────────                        ────────────────────────────
  photo's pair  pairs[photo.id] ─┐
  slider edit   (one role)  ─────┤                   level click:
  swap          (roles exchange)─┼──► colors ◄─────── reachLevel(anchors[role] … target)
  fallback pair (first load fails)┘   anchors ──────►  (reads the anchor; anchors unchanged)
                                        │
                                        │ toHex
                                        ▼
            paint · score · passing level · share link · Markdown
```

**How a photo's pair reaches the screen.**

```
photos[] arrive ─► prepare effect (once per id) ─► extractPair ─► pairs[id]
                                                                     │
photoIndex ─► photo = photos[photoIndex] ─► pairs[photo.id] ready? ──┤
                                                                     ▼
                       during render, if pairFor ≠ photo.id:
                         pairFor = photo.id
                         keepSharedColors? ── yes ─► clear the flag, keep colours (once)
                                          └── no ──► colors = anchors = pair, colour fade "photo" (§16)
                       not ready yet: pairFor = null, colours stay until it arrives
```

**What a share link sets up** (§9.3).

```
share link ─► parseShare (server) ─► shared
  ├─ fg + bg ──► sharedColors ─┬─► initial colors and anchors
  │                            ├─► pairs[shared photo id]  (pre-filled, so it's never extracted
  │                            │                            and ← back to it restores it)
  │                            └─► keepSharedColors = true (first photo shown keeps them)
  ├─ photo ───► waitingForShared = true ─► fetchPhoto first, then the random stream
  └─ algo · font · text ─► initial contrastMethod · font · sampleText
```

### 4.2 Source-of-truth state (`useState`)

| Name | Type | Starts as | What it is | Changed by |
|---|---|---|---|---|
| `sharedColors` | `Pair \| null` | parsed from `shared.colors` | The share link's pair as culori colours. Never changes after mount. | (initialiser only) |
| `colors` | `Pair` | `sharedColors ?? START_COLORS` | The pair on screen. Culori objects in their last-edited mode, not hex. | photo pair, slider edit, swap, level, fallback |
| `anchors` | `Pair` | same as `colors` | Each colour as last set: by a slider edit, swap, a photo's pair or the fallback (ADR 0005). Levels work from these. | photo pair, slider edit, swap, fallback. **Never** by levels. |
| `activeRole` | `Role \| null` | `null` | Active colour: `"text"`, `"bg"` or none. The slider panel is open exactly when this isn't null. | picker clicks, swap, Esc |
| `panelRole` | `Role` | `"text"` | The colour the slider panel shows. Follows `activeRole` during render, but keeps the last value while the panel closes so its contents don't blank mid-animation. | set during render |
| `colorMode` | `ColorMode` | `"hsb"` | Slider colour mode. Changing it never changes the colour. | mode tabs |
| `contrastMethod` | `ContrastMethod` | `shared.method ?? "wcag"` | WCAG or APCA. | method switch |
| `levelsOpen` | `boolean` | `false` | Levels shown beside (desktop) or above (mobile) the score. | score click, Esc |
| `sampleText` | `string` | `shared.text ?? "Aa"` | Sample text (max 100 chars). | typing (via `SampleText`) |
| `font` | `SpecimenFontId` | `shared.font ?? "departure-mono"` | Specimen font. | font menu |
| `fontMenuOpen` | `boolean` | `false` | Font menu open. | dropdown trigger, choose, outside click, Esc |
| `exportOpen` | `boolean` | `false` | Export options open (desktop), or the fallback when the mobile share sheet is missing. | EXPORT/CLOSE, share fallback, Esc |
| `photos` | `Photo[]` | `[]` | The photo stream, in order, including photos loaded ahead. | buffer effect, shared-photo effect, →, Space |
| `photoIndex` | `number` | `0` | Which photo is showing. | ←, →, Space |
| `pairs` | `Record<photoId, Pair>` | shared photo → shared pair, if both given | Each photo's extracted pair, kept so showing a photo is instant and ← restores its original pair. | extraction effect |
| `pairFor` | `string \| null` | `null` | Which photo the colours were last set from. Guards the during-render pair sync. | set during render |
| `colorFade` | `"photo" \| "step" \| "none"` | `"none"` | How the last colour change should animate (§16). | every colour-changing action |
| `keepSharedColors` | `boolean` | `sharedColors !== null` | One-shot flag: the first photo shown skips its pair, so shared colours survive even if the shared photo failed. | cleared during render, once |
| `waitingForShared` | `boolean` | `shared.photoId !== null` | Holds the random stream back until the shared photo has been fetched, so it goes first. | shared-photo effect |

### 4.3 Mutable refs (guards, not rendered)

| Name | What it guards |
|---|---|
| `loadingPhotos` | One random-photo request in flight at a time. Also stops React dev mode's double effect from spending two API calls. |
| `prepared` | Photo ids already preloaded and sent for extraction (each once). Starts with the shared photo id when shared colours exist, so that photo is never extracted. |
| `shown` | Photo ids already shown, so Unsplash download tracking fires once per photo, and Space can find an unseen photo. |
| `sharedRequested` | The shared photo is fetched once (dev double-effect guard). |

### 4.4 Derived values (computed each render)

- `photo = photos[photoIndex] ?? null`
- `pair = pairs[photo.id]` (undefined while extracting)
- `photosAhead = photos.length - 1 - photoIndex`
- `textHex`, `bgHex` via `toHex` (what's painted and scored)
- `[fadeDelay, fadeDuration] = COLOR_FADE_MS[colorFade]`, written to `--colour-fade-delay/-duration` on `<main>`

### 4.5 Constants

| Constant | Value | Meaning |
|---|---|---|
| `START_COLORS` | text = bg = `#1a1718` | An empty dark panel ("Aa" invisible) until the first pair fades in |
| `FALLBACK_COLORS` | `#a39f9f` on `#1a1718` | Shown if the first photo batch fails, so the app still works as a colour tool |
| `COLOR_FADE_MS` | photo `[100, 700]`, step `[0, 200]`, none `[0, 0]` | Colour fade `[delay, duration]` in ms |
| `PHOTO_BATCH` | 3 | Photos per random request |
| `PHOTOS_AHEAD` | 3 | Photos to keep loaded past the current one |

### 4.6 Synchronisation patterns

- **Setting state during render** (React's pattern for state that follows other state) instead of effects: `panelRole`, the photo-pair sync (`pairFor`), `PhotoPanel`'s leaving layer, `RollText`'s leaving layer. This puts the change in the same paint, and `react-hooks` 7 flags `setState` inside effects.
- **`START_COLORS` identity check.** The fallback only applies if `colors` is still the exact `START_COLORS` object (`current === START_COLORS`), meaning nothing has set a colour yet.
- **`useEffectEvent`** for the global `keydown` listener and the dropdown's outside-click listener: added once, always sees the latest state.

### 4.7 Effects (external work)

| Effect | Runs when | Does |
|---|---|---|
| Shared photo | `shared.photoId` (once) | `fetchPhoto(id)`; puts it at the front of `photos` if found; clears `waitingForShared` either way |
| Buffer | `photosAhead`, `waitingForShared` | If not waiting and fewer than 3 ahead: `requestPhotos()`. On success, append. On failure (`[]`), fade in `FALLBACK_COLORS` if nothing has set colours yet. A skip (`null`) does nothing. Also performs the first load. |
| Prepare | `photos` | For each photo not in `prepared`: `preloadPhoto` and `extractPair` → `pairs[id]` |
| Track | `photo` | First time a photo is shown: `trackDownload` (Unsplash requirement) |
| Keyboard | mount | `window` `keydown` → `onKeyDown` (§13) |

---

## 5. Actions: what each input does

| Input | Function | Result |
|---|---|---|
| Colour picker / swatch block | `selectRole(role)` | Same role again → none (panel closes). Other role → switch (panel stays open). |
| Swap | `swap()` | `colorFade = "step"`. Exchanges `colors.text ↔ colors.bg` **and** the anchors. The active colour follows its value: text ↔ bg. With none active, none stays active. |
| Slider drag / keys | `editColor(panelRole, color)` | `colorFade = "none"` (instant). Sets the colour **and** its anchor (a user edit). The new colour is stored in the slider's mode. |
| Colour mode tab | `setColorMode` | Sliders re-read the same colour in the new mode. The colour itself is untouched. |
| Contrast method switch | `setContrastMethod` | Score, grade, levels and passing level recompute. |
| Score | toggle `levelsOpen` | Levels open or close. |
| Level button | `chooseLevel(level)` | `colorFade = "step"`. Role = `activeRole ?? "text"`. Starts from that role's **anchor**, runs `reachLevel` (§6.6), sets `colors[role]`. Anchors untouched. |
| → (photo arrow, dock arrow, ArrowRight) | `nextPhoto()` | If more photos are loaded: index + 1. At the end: `requestPhotos()`, append, then index + 1. If that request is skipped (another is already in flight) or fails, nothing happens (§8.3); when the in-flight batch lands it's appended, but you stay put until you press → again. |
| ← | `previousPhoto()` | index − 1, floored at 0. The earlier photo's **original** pair comes back (edits aren't remembered per photo; that would be history, out of scope). |
| Space | `jumpPhoto()` | Finds the first photo after the current one not yet shown. If it's not already next, moves it to `index + 1`. Then shows it. If none is unseen: fetch a batch, insert it after the current photo, show the first. ← still returns. |
| New photo + its pair ready | (during render) | `pairFor = photo.id`. If `keepSharedColors`: clear it and keep the colours. Otherwise `colorFade = "photo"`, colours **and** anchors = the pair. If the pair isn't ready yet, `pairFor = null` and the colours stay until it arrives. |
| Esc | `onKeyDown` | Closes everything: active colour (slider panel), levels, font menu, export. |
| Font menu choice | `setFont`, close menu | Sample text re-fits in the new font. |
| Typing in sample text | `setSampleText` | Re-fits. Enter or Esc stops editing. |
| EXPORT / CLOSE | toggle `exportOpen` | Options pop in; focus moves to COPY URL. On close, focus goes back to the toggle. |
| COPY URL | `copyText(shareUrl())` | Label shows `COPIED` for 1.5s if it worked. |
| DOWNLOAD .MD | `downloadMarkdown()` | Saves `colour-shift-<fg>-<bg>.md`. Label shows `DOWNLOADED` for 1.5s. |
| Share (mobile) | `share()` | Native share sheet with link + `.md`. `"unsupported"` → `exportOpen = true` (export options take over the row). `"cancelled"` → nothing. |

**The anchor rule (ADR 0005), in one line:** anything that *sets* a colour on the user's behalf (photo pair, slider, swap, fallback) updates the anchor; anything that only *derives* from it (levels) doesn't.

---

## 6. Colour engine

`src/lib/color-engine.ts`. Components ask; this file answers. No other file does colour math (APP-SPEC constraint).

### 6.1 Types

| Type | Definition |
|---|---|
| `Color` | culori's colour object (re-exported) |
| `Role` | `"text" \| "bg"` |
| `Pair` | `Record<Role, Color>` |
| `ColorMode` | `"oklch" \| "hsb" \| "rgb"` |
| `Channel` | `{ key, label, scale, max, step, decimals }` |
| `ContrastMethod` | `"wcag" \| "apca"` |
| `PhotoColor` | `{ hex, population }` (a colour found in a photo, and how many pixels it covers) |

**What "pair" means.** `Pair` is any text colour + background colour, wherever it came from. Several live in state at once, so say which one:

| Name | What it is |
|---|---|
| `colors` | The pair on screen: the one being edited, scored and shared. "The pair" with no qualifier means this one. |
| `anchors` | Each colour as last set; levels start from here (ADR 0005). |
| `pairs[photoId]` | A **photo's pair**: what `pickPair` chose for that photo (or the shared pair, for a shared photo). |
| `sharedColors` | The pair a share link asked for. |
| `START_COLORS`, `FALLBACK_COLORS` | Fixed pairs for before the first photo, and for when photos can't load. |

### 6.2 Colour storage

- A colour is a culori object **kept in the mode it was last edited in**, at full precision. Hex is derived only for display, scoring and export.
- Why: a grey keeps its hue (HSB/OKLCH hue would otherwise be lost through hex), and dragging doesn't snap to whole 0–255 steps.
- `fromHex(hex)`: `culori.parse`; throws if invalid.
- `toHex(color)`: `formatHex`. OKLCH colours go through `clampChroma(color, "oklch")` first, so out-of-gamut values are pulled in by reducing chroma (keeping lightness and hue) rather than by clipping channels.
- **Everything is scored and exported from the hex**, i.e. exactly what's on screen after gamut clamping.

### 6.3 Colour modes and channels (`CHANNELS`)

Slider value = culori value × `scale`.

| Mode (culori mode) | Channel | culori key | Label | Scale | Slider max | Step | Decimals |
|---|---|---|---|---|---|---|---|
| HSB (`hsv`: culori's name for HSB) | Hue | `h` | HUE | 1 | 360 | 0.1 | 1 |
| | Saturation | `s` | SATURATION | 100 | 100 | 0.1 | 1 |
| | Brightness | `v` | BRIGHTNESS | 100 | 100 | 0.1 | 1 |
| OKLCH (`oklch`) | Lightness | `l` | LIGHTNESS | 100 | 100 | 0.1 | 1 |
| | Chroma | `c` | CHROMA | 1 | **gamut max** (≤ 0.4) | 0.001 | 3 |
| | Hue | `h` | HUE | 1 | 360 | 0.1 | 1 |
| RGB (`rgb`) | Red | `r` | RED | 255 | 255 | 1 | 0 |
| | Green | `g` | GREEN | 255 | 255 | 1 | 0 |
| | Blue | `b` | BLUE | 255 | 255 | 1 | 0 |

Functions:

- `getChannel(color, mode, channel)`: converts to the mode (if needed), reads the key, × scale. An undefined hue (greys) reads as 0.
- `setChannel(color, mode, channel, value)`: converts to the mode, writes value ÷ scale, defaults an undefined hue to 0, and **in OKLCH caps chroma** at `maxChroma(l, h)`. Returns a new colour stored in `mode`.
- `channelMax(color, mode, channel)`: the channel's `max`, except OKLCH chroma, which returns `maxChroma(l, h)` for the current colour. So the chroma slider's full width is always "as vivid as sRGB allows here".
- `channelGradient(color, mode, channel)`: a CSS `linear-gradient(to right, …)` of **13 stops**, sweeping this channel from 0 to its max while holding the other two (a live gradient, not Figma's fixed spectrum).
- `formatChannel(value, channel)`: `toFixed(decimals)` for the channel readout.

### 6.4 Gamut: `maxChroma(l, h)`

Binary search for the largest OKLCH chroma that sRGB can display at a given lightness and hue: range `[0, 0.4]`, **20 iterations**, test = `culori.displayable({ mode: "oklch", l, c, h })`. Keeps the low (displayable) side, so the result is always in gamut. Near black or white the answer is close to 0, which is why repeated level clicks used to wash colours to grey (ADR 0005).

### 6.5 Contrast

`getContrast(text, bg, method)` scores the **hex** of each colour:

- **WCAG 2:** `culori.wcagContrast(textHex, bgHex)`. A ratio from 1 to 21; order doesn't matter. Black/white = 21.
- **APCA:** `APCAcontrast(sRGBtoY(textRgb255), sRGBtoY(bgRgb255))` from `apca-w3`. A **signed** Lc; order matters. Positive = dark text on a light background, negative = light text on dark. Black on white = 106.04; white on black = −107.88.
- `toRgb255(hex)`: culori `rgb` → clamp 0–1 → `round(× 255)`.

**Levels and grades.** `LEVELS` and `GRADES` line up index for index, lowest first.

| Method | Level | Grade (≥ level) |
|---|---|---|
| WCAG | 1.5 | Incidental (unofficial; ADR 0004) |
| | 3.0 | AA Large |
| | 4.5 | AA |
| | 7.0 | AAA |
| | (below 1.5) | Fail |
| APCA (`\|Lc\|`) | 30 | Spot |
| | 45 | Headline |
| | 60 | Content |
| | 75 | Body |
| | 90 | Preferred Body |
| | (below 30) | Fail |

Grade names follow WCAG 2 SC 1.4.3/1.4.6 and APCA Bronze Simple Mode (shortest faithful versions).

- `getPassingLevel(value, method)`: the highest level with `|value| ≥ level`, or `null`. This is the highlighted level button.
- `getGrade(value, method)`: the grade at the passing level, or `"Fail"`. Uses the **real** value, never the truncated one.
- `formatLevel(level, method)`: WCAG `toFixed(1)` (`3.0`), APCA integer (`60`).
- `formatScore(text, bg, method)`: `AA 5.21:1` (WCAG, 2 decimals) or `Content Lc -64.3` (APCA, 1 decimal, signed). Values are **truncated toward zero, never rounded**, so 4.499 shows `4.49`, not a passing-looking `4.50`.
- `readableOn(bg)`: `#000000` or `#ffffff`, whichever has the larger `|APCA Lc|` with that colour as text on `bg` (black wins a tie). Used for the mobile swatch hex, so it stays readable even when the pair itself has low contrast.

### 6.6 `reachLevel(pair, role, target, method)`

Moves one colour's **OKLCH lightness** until the pair just reaches `target`, keeping hue (chroma is capped to gamut on the way, through `setChannel`).

1. `strength(l)` = `|contrast|` with `pair[role]` set to lightness `l` (0–1). `passes(l)` = `strength(l) ≥ target`.
2. Sample `l` at **101 points** (0, 0.01, …, 1).
3. Wherever two neighbouring samples differ (pass vs fail), **bisect 24 times**, always keeping the passing side, so the result really meets the level.
4. Contrast dips to about 1 where the two colours match and rises towards black and white, so there's usually a crossing on each side. Take the crossing **nearest the starting colour's lightness** (in practice the anchor's, since `chooseLevel` passes the anchor in).
5. No crossings (nowhere passes, or everywhere does): go to whichever end (`l = 0` or `1`) gives more contrast. The score then shows what was actually reached, and the passing level stays honest (e.g. APCA 90 on mid-grey stops at `Content Lc -68.5`).

`ColorShift.chooseLevel` always passes the **anchor** as the starting colour (ADR 0005). Example from the LOG (step 2, when the app still started on pink `#ff6f91` text on `#3a1020`): clicking APCA 90 then 30 gave `#d2456b` when working from the anchor, but a muddy `#907478` when each click worked from the previous result.

Every level click goes **up or down** to just reach the target, so every *reachable* level is one click away; an unreachable one gets as close as it can (step 5).

### 6.7 `pickPair(photoColors)`: pairing from a photo

Input: the photo colours from node-vibrant (up to 6: Vibrant, Muted, DarkVibrant, DarkMuted, LightVibrant, LightMuted; missing ones are skipped).

1. Drop colours with population 0. None left → `null`.
2. One colour → add black or white, whichever has the higher WCAG contrast with it.
3. Score **every pair** (up to 15): `score = ln(wcagRatio) + VIVID_WEIGHT × (chroma(a) + chroma(b))`, with OKLCH chroma. `VIVID_WEIGHT = 2`: two strong colours (chroma 0.2 each) are worth about as much as doubling the contrast ratio.
4. Keep only pairs with ratio ≥ `MIN_PAIR_CONTRAST` (1.5) if any exist; otherwise use them all.
5. Take the top score. **The darker colour (lower OKLCH lightness) becomes the background.**

Intent (APP-SPEC): prefer a vivid, dramatic pair over muted averages. `VIVID_WEIGHT` is still a first guess; raise it if pairs lean too much on near-black backgrounds.

### 6.8 `exportMarkdown({ colors, method, shareUrl, credit })`

```markdown
# Colour Shift pair

| | Hex | RGB | OKLCH |
| --- | --- | --- | --- |
| Text | `#D2456B` | `rgb(210 69 107)` | `oklch(58.6% 0.170 9.4)` |
| Background | `#3A1020` | `rgb(58 16 32)` | `oklch(…)` |

**Contrast (WCAG 2):** AA 5.21:1

**Share link:** https://colour-shift.vercel.app/?…

Photo by [Name](…utm…) on [Unsplash](…utm…)
```

(Values above are illustrative.) Every value is computed from the on-screen hex, re-parsed, so it describes what's actually shown. OKLCH lightness as a % to 1 decimal, chroma to 3, hue to 1. The credit line is left out when there's no photo.

---

## 7. Back end: `/api/photos`

`src/app/api/photos/route.ts`, one `GET` handler. The only server code; the only place `UNSPLASH_ACCESS_KEY` is read.

### 7.1 Endpoints

| Request | Unsplash call(s) | Success | Failure |
|---|---|---|---|
| `GET /api/photos?count=N` | N × `GET /photos/random?query=<word>`, in parallel, one word each from a shuffled list | `200` `Photo[]` (photos that failed are dropped) | `502` `{ error: "Unsplash returned no photos" }` if none came back |
| `GET /api/photos?id=<id>` | `GET /photos/<id>` | `200` `Photo` | `404` `{ error: "Photo not found" }` |
| `GET /api/photos?download=<id>` | `GET /photos/<id>/download` (download tracking) | `200` `{ ok: true }` | `502` `{ ok: false }` |
| any, with no key set | none | | `500` `{ error: "UNSPLASH_ACCESS_KEY is not set" }` |

Precedence: `download` first, then `id`, then `count`. `count` is clamped to **1–10** (`MAX_COUNT`); missing or invalid counts as 1. Ids are `encodeURIComponent`-ed into the path.

### 7.2 Unsplash request details

- Base `https://api.unsplash.com`, headers `Authorization: Client-ID <key>`, `Accept-Version: v1`, `cache: "no-store"`.
- `unsplash<T>()` returns `null` on any failure (network or non-2xx), so one bad photo doesn't sink a batch.
- **No `orientation=landscape`**: the photo panel is nearly square or taller, so landscape photos lost too much to cropping.

### 7.3 Search words (40)

Plain `/photos/random` returns a narrow curated set, so each photo is drawn from a different word (Fisher–Yates shuffle, take the first N):

> nature, architecture, abstract, texture, city, landscape, portrait, street, minimal, ocean, mountain, forest, desert, sky, neon, vintage, food, macro, wildlife, interior, fashion, art, industrial, graffiti, flower, space, night, rain, fog, sunset, snow, autumn, reflection, shadow, pattern, travel, fruit, market, bird, ceramics

### 7.4 Response shape (`src/types/photo.ts`)

```ts
type Photo = {
  id: string;
  rawUrl: string;          // imgix base URL (urls.raw); add w= etc. for a sized copy
  alt: string;             // alt_description ?? "Unsplash photo"
  photographer: string;    // user.name
  photographerUrl: string; // user.links.html + UTM
  photoUrl: string;        // links.html + UTM
};
```

UTM appended to both links: `utm_source=colour_shift&utm_medium=referral`.

### 7.5 Unsplash rules the app follows

1. **Credit every photo** with the photographer's name and an Unsplash link (`PhotoPanel`, Markdown export).
2. **Link back with the UTM tags** above (added on the server).
3. **Trigger the download endpoint when a photo is used.** "Used" = shown, not just loaded ahead (`shown` ref). Fire and forget.
4. **Hotlink images** from Unsplash's CDN (plain `<img>` on `rawUrl` with size parameters), never re-hosted.

### 7.6 Rate-limit budget

The demo key allows **50 requests/hour**. Each random photo costs 1 call; each shown photo adds 1 download ping, so **about 2 per photo** in steady use.

| Scenario | Calls |
|---|---|
| Fresh load | 6 random (two batches of 3: the first load, then a top-up to 3 ahead) + 1 download = **7** |
| Share link with a photo | 1 by id + 3 random + 1 download = **5** |
| Share link whose photo fails | 1 + 6 + 1 = **8** |
| Each → after that | 1 download, plus a batch of 3 random every third step (~1 per photo) |

When the limit is hit, Unsplash returns 403 (`x-ratelimit-remaining: 0`) → the route returns 502 → the client warns and shows the fallback pair on first load (§8.4).

### 7.7 Environment

- `UNSPLASH_ACCESS_KEY` in `.env.local` locally; in Vercel for **Preview** and **Production** (Production stored as a Secret, so it can't be read back).
- Never `NEXT_PUBLIC_`, never in client code, logs or commits.

---

## 8. Photo pipeline (browser side)

`src/lib/photos.ts` + the effects in `ColorShift` + `PhotoPanel`.

### 8.1 URL sizing (imgix parameters on `rawUrl`)

| Function | Width | Use |
|---|---|---|
| `photoSrc(photo)` | 1600 (`DISPLAY_WIDTH`) | The full photo |
| `previewSrc(photo)` | 200 (`EXTRACT_WIDTH`) | Extraction **and** the blurred preview (same URL, so it's cached) |

All with `q=80&auto=format&fit=max`.

### 8.2 Lifecycle of one photo

```
/api/photos?count=3 ─► photos[] ─► prepare effect (once per id, `prepared` ref)
                                     ├─ preloadPhoto: new Image().src = photoSrc  (1600px into cache)
                                     └─ extractPair: node-vibrant on previewSrc (200px) → pickPair → pairs[id]
user reaches it ─► photo = photos[photoIndex]
                   ├─ during render: pair ready? → colours + anchors (colorFade "photo")
                   ├─ track effect: first time shown → trackDownload (/api/photos?download=id)
                   └─ PhotoPanel: slide (desktop) / crossfade (mobile), preview under, credit, arrows
```

- **`extractPair`** dynamically imports `node-vibrant/browser` on first use (it needs the DOM, and keeping it out of the first bundle helps load time). It reads the palette, maps non-null swatches to `PhotoColor`s, and calls `pickPair`. Returns `null` on any failure.
- **CORS:** node-vibrant loads the 200px image with `crossOrigin = "anonymous"`. The preview `<img>` uses the same attribute so the browser reuses that cached copy.
- **Photo and pair paint together.** The colours follow the current photo's pair during render, not in an effect. If the pair isn't extracted yet, the photo shows first and the colours change when it arrives.

### 8.3 Buffer

- Keeps `PHOTOS_AHEAD` (3) photos past the current one, fetching `PHOTO_BATCH` (3) at a time. The same effect does the first load.
- `requestPhotos()` returns `Photo[]` on success, `[]` on failure (after `console.warn`; a warning rather than an error so Next's dev overlay doesn't pop up), and `null` if skipped because one is already in flight.
- The buffer counts photos **ahead**, not *unseen* ahead. After walking back, Space may need a fetch; `jumpPhoto` handles that.

### 8.4 Failure handling

| Failure | What happens |
|---|---|
| First batch fails (e.g. rate limit) | `FALLBACK_COLORS` fade in, only if nothing has set colours yet. The app still works as a colour tool. |
| Later buffer top-up fails | Nothing visible. No automatic retry (the effect's inputs didn't change); the next → at the end of the stream tries again. |
| → at the end of the stream and the fetch fails | Stays on the current photo. |
| One photo's palette can't be read | No pair for it; the colours stay as they were. |
| Shared photo can't be fetched | The stream starts with random photos; shared colours survive (`keepSharedColors`). |
| Download tracking fails | Ignored (fire and forget). |

---

## 9. Share links

`src/lib/share.ts`. A URL that reopens the same photo, pair, contrast method, specimen font and sample text.

### 9.1 Format

```
/?photo=<id>&fg=<hex>&bg=<hex>&algo=apca&font=<id>&text=<text>
```

| Param | Value | Left out when |
|---|---|---|
| `photo` | Unsplash photo id | no photo is showing |
| `fg` | text colour, 6 hex digits, no `#` | always present |
| `bg` | background colour, same format | always present |
| `algo` | `apca` | WCAG (default) |
| `font` | specimen font id | Departure Mono (default) |
| `text` | sample text (URL-encoded) | `"Aa"` (default) |

- **No `swap` param:** swap exchanges the colours themselves, so `fg`/`bg` already say which is which.
- **Built on demand** (`shareUrl()` in `ColorShift`: `window.location.origin + "/?" + shareQuery(...)`) when copied, shared or exported. The address bar is never updated.
- Colours go through `toHex`, so an OKLCH-edited colour reopens very slightly rounded (8-bit). Accepted.

### 9.2 Parsing and validation (`parseShare`, on the server)

Each field is checked on its own; anything missing or invalid becomes `null` and its default is used. Array-valued params are ignored.

| Field | Accepted if |
|---|---|
| `photo` | `/^[\w-]{1,64}$/` |
| `fg` + `bg` | **both** match `/^[0-9a-f]{6}$/i`; otherwise both are ignored |
| `algo` | `wcag` or `apca` |
| `font` | one of the seven ids |
| `text` | any string, cut to 100 characters (`MAX_TEXT_LENGTH`, in `share.ts`) |

`NOTHING_SHARED` is the all-null value.

### 9.3 Opening a share link

1. Server: `parseShare` → `shared` (hex strings, not culori objects, cross the server/client boundary).
2. Client: `useState` initialisers start from `shared` (no flash of defaults). Colours are made with `fromHex` on the client.
3. If there's a photo id, the random stream waits (`waitingForShared`). The shared photo is fetched first and put at the front.
4. Its pair is **pre-filled** with the shared colours and marked `prepared`, so it's never extracted, and ← back to it restores the shared colours.
5. `keepSharedColors` makes the first photo shown skip its pair once, so the shared colours survive even if the shared photo failed and a random one came first.
6. Then the buffer fills with random photos as usual.

---

## 10. Export and share

`src/lib/export.ts` (browser APIs) + `ExportControls` (`dock.tsx`) + `share()` in `ColorShift`.

| Function | Does |
|---|---|
| `copyText(text)` | `navigator.clipboard.writeText`; if that throws (blocked, not a secure context): a hidden readonly `<textarea>` + `document.execCommand("copy")`. Returns whether it worked. |
| `downloadText(filename, text, type = "text/markdown")` | Blob → object URL → temporary `<a download>` → click → revoke. |
| `shareLink({ url, filename, markdown })` | `navigator.share` with the `.md` file + URL. Tries `text/markdown`, then `text/plain` (via `canShare`), then the URL alone. Returns `"shared"`, `"cancelled"` (AbortError: the person closed the sheet) or `"unsupported"` (no share API, or any other error). |

- **Filename:** `colour-shift-<fghex>-<bghex>.md` (no `#`).
- **Desktop:** EXPORT → COPY URL, DOWNLOAD .MD; the toggle's label rolls to CLOSE. Confirmation labels (`COPIED`, `DOWNLOADED`) last 1.5s and reserve the longest label's width (`StableLabel`, in `dock.tsx`), so nothing nudges.
- **Mobile (ADR 0006):** the share button opens the native share sheet (which already offers copy, Save to Files, Messages, AirDrop). It must run **straight after the tap**, with no awaits before `navigator.share`. It needs **HTTPS**, so test on a Vercel preview, not LAN dev. `"unsupported"` → the export options take over the bottom bar's row.

---

## 11. Components

### 11.1 Tree

```
<main h-dvh flex-col, --colour-fade-*>                    color-shift.tsx
├── <Stage>                                               stage.tsx
│   ├── colour panel (bg = bgHex, color = textHex, colour fade)
│   │   ├── <Dropdown> specimen font (top-left)           ui/dropdown.tsx
│   │   └── <SampleText>                                  sample-text.tsx
│   └── <PhotoPanel>                                      photo-panel.tsx
│       ├── <PhotoLayer> leaving (slide out / hold)
│       ├── <PhotoLayer> current (slide in / fade in, preview under)
│       ├── credit (desktop: bottom-right, long; mobile: top-left, short)
│       └── <PhotoArrow> ×2
├── <Reveal open={activeRole !== null}>                            ui/reveal.tsx
│   └── <SliderPanel color={colors[panelRole]}>           slider-panel.tsx
│       ├── mode tabs (<Button selected>) ×3
│       ├── channel readout
│       └── <Slider> ×3                                   ui/slider.tsx
├── <Dock>  (max-sm:hidden)                               dock.tsx
│   ├── <ColorPicker> text · swap <Button> · <ColorPicker> bg
│   ├── <SegmentedControl> WCAG | APCA
│   ├── <Levels> (when open) · <Score>
│   └── ← → <Button>s · <ExportControls>
└── <BottomBar> (sm:hidden)                               bottom-bar.tsx
    ├── swatch row: <SwatchBlock> text · swap · <SwatchBlock> bg
    ├── <Reveal open={levelsOpen}> <Levels stretch>
    └── <SegmentedControl> · <Score> · share <Button>   (or <ExportControls open> as fallback)
```

### 11.2 Layout components

| Component | Props in | Local (visual-only) state | Notes |
|---|---|---|---|
| `Stage` | hexes, photo, index, sample text, font, menu state, callbacks | none | Grid: 2 columns on desktop; on mobile, rows `minmax(160px,1fr) minmax(0,1fr)` (colour panel keeps 160px, the photo gives way first). Colour panel `transition-colors` using the fade variables. |
| `SampleText` | `text`, `fontFamily`, `textHex`, `onChange` | refs only | `contentEditable="plaintext-only"`, **uncontrolled**: React never renders its children (the caret stays put); `onInput` copies to state; a layout effect copies state in only when it differs (share links). Shrink to fit: binary search 96 → 16px, whole px, written straight to `style.fontSize` before paint; re-runs on text, font, resize (`ResizeObserver`) and `document.fonts` `loadingdone`. At 16px a too-long word may break anywhere. Inset 64px desktop; 24px sides / 56px top and bottom on mobile. Over 100 chars → trimmed, caret to end. Empty → stray `<br>` removed so the `Aa` placeholder (`empty:before`) shows. Enter/Esc blur. Hover 65% opacity, full while focused. Selection tint = text colour at 20% (`--sample-color` + `color-mix`). `role="textbox"`, no focus ring (the caret is the focus state). |
| `PhotoPanel` | `photo`, `index`, arrows | `current`, `leaving` | When `photo` changes (during render), the old one becomes `leaving` with direction = index went up (→, slides out left) or down (←). The leaving layer is removed on `animationend`. Layers keyed by photo id. `bg-surface-raised` behind. |
| `PhotoLayer` | `photo`, `preview`, `className`, `onAnimationEnd` | `loaded`, `withPreview` (read once) | Preview: the 200px copy, `blur-xl scale-110`. Full photo fades in over 400ms when loaded. The first photo gets no preview: a quick 200ms fade. `onAnimationEnd` ignores bubbled events from children. |
| `PhotoArrow` | direction, label, onClick | none | 40px, canvas fill, 20px icon (16px on mobile). Visible on panel hover or focus; always on `pointer-coarse`. |
| `SliderPanel` | `color`, `colorMode`, callbacks | `readoutChannel`, `readoutVisible`, fade timer | Readout shows on slider hover, focus or change; fades 1s (`READOUT_FADE_DELAY`) after release or pointer leave; only shown if the channel belongs to the current mode. Sliders keyed `${mode}-${key}`. |
| `Dock` | pair, active role, method, levels, export, callbacks | none | Desktop only. `grid-cols-2`, 56px tall, `px-4`. Left half: pickers + swap (4px apart) at the left edge, empty space, then the method switch ending 12px left of centre. Right half: levels + score from 12px right of centre, growing rightwards; arrows + export pushed right. **The switch never moves.** |
| `ExportControls` (in `dock.tsx`) | `open`, toggle, copy, download | `done`, timer | Focus to COPY URL on open, back to the toggle on close. Also used by `BottomBar` as the share fallback (always `open` there). |
| `BottomBar` | like `Dock` + `onShare` | none (refs) | Mobile only. Swatch row 64px, three columns: text block · swap button · background block. Widths `1fr 1fr 1fr` (none active), `2fr 1fr 1fr` (text active) or `1fr 1fr 2fr` (background active), so the active block takes half the row; the change animates. Levels in a `Reveal` (16px gap inside, so it collapses too). Row: method switch + score (outlined at rest, filled while open) … share. Safe-area bottom padding. Hands focus back to the share button when export closes. |
| `SwatchBlock` (in `bottom-bar.tsx`) | label, colour, active, onClick | none | Full-height block in the colour; hex in `readableOn` black/white, rolling. Hairline inset edge. |

### 11.3 UI pieces (`src/components/ui/`)

Small and reusable; layouts combine them and don't edit them for layout tweaks.

| Piece | What it is | Key details |
|---|---|---|
| `Button` | Base button | `type="button"`. Props `icon` (8×6 padding), `selected`, `strong`. States: hover `surface-raised`; pressed scale 0.95 + 1px inside `stroke` outline; selected `surface-raised` + inside outline + strong text; focus 1px `focus` ring. Outlines are drawn 1px inside (`-outline-offset-1`) so buttons never grow. |
| `ColorPicker` | Swatch + hex | A `Button` with `selected` = active, `aria-pressed`, sr-only label, hex in `RollText` (7ch wide). |
| `Swatch` | 12px chip | `rounded-[2px]`, 0.5px `swatch-edge` border, inline colour (allowed: it's state), colour fade. |
| `SegmentedControl` | WCAG/APCA switch | `well` track, 2px padding; selected tab raised with strong text, no outline; `aria-pressed`. |
| `Score` | Score toggle | `Button` with `strong` while open, `aria-expanded`, `aria-live="polite"`, text in `RollText`. |
| `Levels` | Level buttons | Unselected on `well`; the passing level uses the selected look. `stretch` (mobile) = equal widths, 40px tall. |
| `Slider` | One channel slider | An invisible native `<input type="range">` on top (drag, keys, screen readers) over a drawn track and grip. Track: 6px, fully round, live gradient, 1px `track-edge` border, `bg-origin-border` (otherwise the gradient repeats under the border). Grip: 8px dot → 24px glass (`backdrop-blur-[3px]`) on row hover or while active; its centre travels 12px in from each end to match the 24px native thumb. Touch: +8px hit area above and below. |
| `Dropdown` | Font dropdown + menu | Generic over option id. Open state lives in the parent. Outside `pointerdown` closes. On open, focus goes to the checked item; ↑ ↓ wrap through `menuitemradio`s; choose or Esc → focus back to the trigger. Opens with a `starting:` fade + 4px drop; closes instantly. 180px menu. 40px trigger on mobile. |
| `Reveal` | Open/close wrapper | Grid row `0fr ↔ 1fr` + opacity + 4px slide, both ways. Content stays mounted and is `inert` while closed. |
| `RollText` | Rolling value | Leaving and current layers (set during render). One `inline-block` span per character with `animation-delay = 12ms × i`. A layout effect sets `data-fast` when changes come less than 300ms apart → no animation, leaving layer hidden (live while dragging). The leaving layer is absolute, so width follows the new value at once. `whitespace-nowrap`; sr-only copy for screen readers, characters `aria-hidden`. |

### 11.4 Inline styles allowed

Only for values that are state: the pair's colours (stage, swatch, swatch blocks, `--sample-color`), the specimen font family, the fade variables on `<main>`, the slider gradient and grip position, the mobile swatch-row columns, and the measured sample-text font size. Chrome colours always use token classes.

---

## 12. Desktop vs mobile

Breakpoint: **640px** (Tailwind `sm`). Landscape phones and tablets ≥ 640px get the desktop layout for now.

- **Both bars are always rendered**; CSS picks one (`Dock` is `max-sm:hidden`, `BottomBar` is `sm:hidden`). So the server render never has to guess the width, and there's no layout flip. Same state, same callbacks.
- **Hover-only things use `pointer-coarse:`** (touch), not width: photo arrows always visible on touch, slider touch area +8px.
- The page fills `h-dvh` (the visible area, whatever the browser's toolbars do). `viewport-fit=cover` + `env(safe-area-inset-bottom)` clears the home bar.
- DOM order already matches the mobile stack: colour panel, photo, slider panel, bar.

| | Desktop (≥ 640px) | Mobile (< 640px) |
|---|---|---|
| Stage | Colour panel beside photo panel | Stacked: colour panel (min 160px) over photo (shrinks first) |
| Bar | `Dock` (56px, one row) | `BottomBar` (swatch row, levels, contrast row) |
| Colour pickers | Swatch + hex buttons | Full-height swatch blocks, active one 2fr, black/white hex |
| Levels | Beside the score; fade + 8px from the left, close instantly | Full-width row above the contrast row, `Reveal` both ways |
| Score | Plain toggle; white text when open | Outlined at rest, filled while open |
| Keeping a pair | EXPORT → COPY URL, DOWNLOAD .MD | Share → native share sheet; fallback = export options |
| Photo change | Slides sideways (600ms) | Crossfades (no sideways motion on mobile) |
| Photo arrows | On hover + in the dock | Always shown on the photo; none in the bar |
| Credit | `Photo by Name on Unsplash`, bottom-right | `Name / Unsplash`, top-left |
| UI text | 12px | 14px (`body` media query in `globals.css`) |
| Controls | 28px buttons | 40px; sliders 28px touch area |
| Sample text inset | 64px | 24px sides, 56px top/bottom |

---

## 13. Accessibility and keyboard

**Keyboard** (one `window` `keydown` listener, via `useEffectEvent`):

| Key | Action | Skipped when |
|---|---|---|
| Esc | Close slider panel, levels, font menu, export | never |
| ← / → | Previous / next photo | typing in an input, textarea, select or contenteditable (so a focused slider keeps its arrows); with Cmd/Ctrl/Alt (Cmd+← stays browser back) |
| Space | Jump to a new photo | same as above; also when a button is focused (Space presses it) |
| Enter / Esc in sample text | Stop editing | |
| ↑ / ↓ in font menu | Move between fonts (wraps) | |

**Other details:**

- Every control has a visible focus ring (1px, white 20%), except the sample text (its caret is the focus state).
- Toggle buttons use `aria-pressed` (pickers, levels, tabs, method switch, swatch blocks) or `aria-expanded` (score, export toggle, font trigger).
- Icon buttons have `aria-label`s; colour pickers and swatch blocks have sr-only labels.
- `Score` is `aria-live="polite"`; confirmation labels are `aria-live`.
- `RollText` hides its per-character spans from screen readers and provides one sr-only copy.
- Closed panels are `inert` (no tabbing in, skipped by screen readers).
- Focus is managed when export opens and closes, and when the font menu opens, chooses or escapes.
- UI text isn't selectable (`user-select: none` on `body`), except the sample text.
- `lang="en-GB"`.

---

## 14. Fonts

### 14.1 UI font

`--font-ui: "Input Mono", var(--font-geist-mono), ui-monospace, monospace`, 12px (14px mobile), `line-height: 1`, tabular figures.

### 14.2 Specimen fonts (`src/lib/fonts.ts`)

| id | Label | Loaded via | Licence / where it shows | Fallback |
|---|---|---|---|---|
| `departure-mono` (**default**) | Departure Mono | `@font-face`, committed woff2 | SIL OFL, served to everyone | Geist Mono |
| `input-mono` | Input Mono | `@font-face`: `local()` → dev-only file | Licensed: only where installed | Geist Mono |
| `geist` | Geist | `next/font/google` (`--font-geist-sans`) | Free, hosted with the site | sans-serif |
| `geist-mono` | Geist Mono | `next/font/google` (`--font-geist-mono`) | Free | monospace |
| `instrument-serif` | Instrument Serif | `next/font/google` (`--font-instrument-serif`, weight 400) | Free | serif |
| `alpha-lyrae` | Alpha Lyrae | `@font-face`: `local()` → dev-only file | Licensed: only where installed | Geist |
| `ghost-byte` | Ghost Byte | `@font-face`: `local()` → dev-only file | Licensed: only where installed | Geist Mono |

- **ADR 0002:** licensed fonts are never committed or uploaded. Their `@font-face` tries `local()` first, so the live site shows them on the owner's machine (likely Chrome only: Safari may not expose user-installed fonts), then the gitignored `/fonts/…` file (local dev only), else the free fallback. No web licences were bought; buy them if the site is ever meant for others.
- **Why plain `@font-face`, not `next/font/local`:** `next/font/local` fails the build when the file is missing; `@font-face` just falls back.
- `font-display: swap` throughout. The sample text re-fits on `document.fonts` `loadingdone`.
- opentype.js dropped: MDS used it only for social preview images (out of scope).
- Alpha Lyrae and Ghost Byte aren't installed on the owner's Mac yet (fallbacks show).

---

## 15. Design tokens

Defined once in `:root` in `src/app/globals.css` (`--cs-*`), then mapped to Tailwind classes in `@theme inline`. `--color-*: initial` removes Tailwind's default palette, so only token colours exist as classes. No raw hex in components.

| CSS variable | Value | Tailwind colour | Use |
|---|---|---|---|
| `--cs-canvas` | `#0f0e0f` | `canvas` | Page, dock, slider panel, photo arrows |
| `--cs-surface` | `#1a1718` | `surface` | Panels, font menu, start/fallback panel colour |
| `--cs-surface-raised` | `#262626` | `surface-raised` | Hover and selected fill; behind photos |
| `--cs-surface-control` | `#212121` | `surface-control` | Font dropdown trigger, selected font option |
| `--cs-stroke` | `#3e3e3e` at 80% | `stroke` | Selected/pressed outline (1px, inside) |
| `--cs-border` | `#1b191a` | `border` | Dividers |
| `--cs-well` | `#000000` | `well` | Recessed groups: method switch, level buttons |
| `--cs-text-muted` | `#a39f9f` | `muted` | Default UI text |
| `--cs-text-strong` | `#ffffff` | `strong` | Selected/active text |
| `--cs-text-value` | `#e5e0e0` | `value` | Channel readout value, credit, font trigger |
| `--cs-swatch-edge` | `#fafafa` at 30% | `swatch-edge` | 0.5px swatch border |
| `--cs-focus` | white at 20% | `focus` | Keyboard focus ring |
| `--cs-track-edge` | white at 15% | `track-edge` | Slider track border |
| `--cs-grip` | `#ffffff` | `grip` | Resting grip dot |
| `--cs-grip-edge` | white at 10% | `grip-edge` | Resting grip border |
| `--cs-grip-glass` | white at 20% | `grip-glass` | Expanded grip fill |
| `--cs-grip-glass-edge` | white at 40% | `grip-glass-edge` | Expanded grip border |

Other theme values: `--font-ui`; `--default-transition-duration: 200ms` and `--default-transition-timing-function: cubic-bezier(0.33, 1, 0.68, 1)` (plain `transition` uses the style guide's default).

Shape: 4px radius everywhere (swatches 2px, round items full). Buttons `p-2` (icon buttons `px-2 py-1.5`).

---

## 16. Motion

CSS only: transitions, `@starting-style` (`starting:`) and keyframes. No GSAP or animation libraries. Full rules in the style guide; this is where each piece lives.

| Motion | Where | Timing |
|---|---|---|
| Default (hover, press, fades, panels) | `--default-transition-*` | 200ms, ease-out `cubic-bezier(0.33, 1, 0.68, 1)` |
| Photo slide (desktop) | `animate-slide-{in,out}-{left,right}` keyframes | 600ms ease-out |
| Photo crossfade (mobile) | `animate-fade-in` (new) + `animate-hold` (old stays opaque underneath so its `animationend` still fires) | 600ms |
| Full photo over preview | `PhotoLayer` `duration-400` | 400ms (first photo: 200ms default) |
| Colour fade: photo | `COLOR_FADE_MS.photo` (`color-shift.tsx`) → `--colour-fade-*` | 100ms delay + 700ms (trails the slide) |
| Colour fade: step (swap, level) | `COLOR_FADE_MS.step` | 200ms |
| Colour fade: slider drag | `COLOR_FADE_MS.none` | instant |
| Rolling value (score, hex, EXPORT ⇄ CLOSE) | `animate-roll-{in,out}` (`globals.css`) + `ROLL_STAGGER_MS` / `ROLL_SETTLE_MS` (`ui/roll-text.tsx`) | 300ms, 55% travel, 0.5px blur, 12ms stagger; changes < 300ms apart show instantly |
| Export options pop | `animate-pop-left` | 400ms, 16px, overshoot `cubic-bezier(0.34, 1.56, 0.64, 1)`; close instantly |
| Panels (slider panel, mobile levels) | `Reveal` | grid row 0fr ↔ 1fr + fade + 4px, both ways |
| Font menu, desktop levels | `starting:` | fade + 4px drop / 8px from the left on open; close instantly |
| Grip | `Slider` | 8px → 24px glass on hover/drag |
| Channel readout | `READOUT_FADE_DELAY` (`slider-panel.tsx`) | fades 200ms, 1s after release |
| Mobile swatch row | `transition-[grid-template-columns]` | 200ms |

**Rules:** live input is instant; menus and inline options open softly and close instantly; panels that change the layout animate both ways; small distances (4/8/16px, only the photo moves full width); colours trail the photo.

**Reduced motion** (`globals.css`): transitions 0ms, animations **1ms** (not `none`), so `animationend` still fires and leaving photos and rolling layers are removed.

Tuned values were found live with DialKit (steps 6–7) and are now plain constants. Change the code and the style guide together.

---

## 17. Build, tooling and deploy

### 17.1 Local

```sh
pnpm install
echo "UNSPLASH_ACCESS_KEY=your-key" > .env.local
pnpm dev        # run in its own Terminal, not via Claude's `!` (it gets backgrounded and stopped)
```

- pnpm 12.6.0 via corepack, installed to `~/.local/bin` (`packageManager` pins it).
- `pnpm lint` and `pnpm build` must pass before every commit.
- `allowedDevOrigins` (`192.168.*.*`, `10.*.*.*`, `*.local`) lets a phone on the same Wi-Fi open the dev server. The share sheet still needs HTTPS (use a Vercel preview).
- Next 16 refuses a second dev server for the same folder.
- **Next.js 16 differs from training data:** read `node_modules/next/dist/docs/` before writing Next-specific code. Things this project relies on: async `searchParams`, the `PageProps<"/">`/`LayoutProps<"/">` global types, `useEffectEvent`, metadata routes (`icon.svg`, `apple-icon.tsx`).

### 17.2 Vercel

- Project `duat3/colour-shift`, linked via `.vercel/` (gitignored). **Git-connected: every push to `main` deploys to Production** (~1 min).
- `UNSPLASH_ACCESS_KEY` in Preview and Production (Production is a Secret). **Never run `vercel env pull`** (it would rewrite `.env.local`, and the secret can't be read anyway).
- Add an env var non-interactively by piping the value in: `grep … .env.local | cut -d= -f2- | tr -d '\n' | vercel env add NAME production --yes`. A new or changed env var needs a redeploy.
- Preview deploy: `vercel deploy --target preview` (the bare command made the first deploy Production). Previews are behind Vercel login; test the API with `vercel curl`.
- `.vercelignore` keeps licensed fonts and `.env*` out of uploads.
- Pause/unpause: `vercel api /v1/projects/<id>/pause|unpause -X POST` (id in `.vercel/project.json`).

### 17.3 Workflow (from CLAUDE.md)

Plan → approval → build one step at a time → browser check → small commit (`feat:`, `fix:`, `style:`, `docs:`) → LOG entry at the top of `docs/LOG.md` in the same commit. New term → `CONTEXT.md`. Hard-to-reverse trade-off → new ADR.

---

## 18. Decisions

### 18.1 ADRs (`docs/adr/`)

| # | Decision | Why | Lives in |
|---|---|---|---|
| 0001 | **Figma is the source of truth** for visuals; wins over the style guide. Mockup contrast numbers are illustrative only. | The design was drawn in Figma after the style guide was taken from MDS. | Tokens, slider/grip, all layouts |
| 0002 | **Licensed fonts stay local**: never committed or uploaded; `local()` first, then a dev-only file, else a free fallback. Departure Mono (SIL OFL) is committed. | Public repo; licences forbid redistribution; site is for the owner's use. | `globals.css`, `lib/fonts.ts`, `.gitignore`, `.vercelignore` |
| 0003 | **"Colour" for people, "color" for code.** | Matches CSS and libraries in code; British in the product. Don't "fix" either side. | Everywhere |
| 0004 | **WCAG gets an unofficial 1.5 "Incidental" level.** | Useful for display text and inactive states; parallels APCA's Spot (Lc 30). Labelled so it's clearly not a pass. | `LEVELS`, `GRADES` |
| 0005 | **Levels move from the anchor colour**, not the current colour. | Gamut clamps near black/white compounded across clicks and washed colours to grey. | `anchors` state, `chooseLevel` |
| 0006 | **Mobile shares through the native share sheet** (link + `.md`); own options only as a fallback. | The sheet already does copy, Files, Messages, AirDrop; a downloaded `.md` is awkward on a phone. | `shareLink`, `BottomBar` |

### 18.2 Other decisions (from the LOG and CLAUDE.md)

**Colour and contrast**
- Colours are culori objects in their last-edited mode, not hex (keeps a grey's hue, no 0–255 rounding while dragging).
- Contrast scores the displayed hex, after gamut clamping.
- Score display truncates, never rounds; grades use the real value; APCA grades use `|Lc|`.
- APCA score shows the signed Lc (negative = light text on dark).
- Default colour mode HSB (Figma shows HSB).
- Track gradients are live (other channels held), not a fixed spectrum.
- Swap keeps the same value active, now in its new role.
- An unreachable level moves the colour as far as it can; the score shows the real value.
- Swatch hex on mobile is black or white by APCA, never the pair's other colour.

**Photos**
- Plain `<img>` for photos, not `next/image` (Unsplash already resizes; Vercel's optimiser would add cost and a second resize).
- No `orientation=landscape` (crop losses in a squarish panel).
- One photo per shuffled search word (plain random is too narrow).
- A photo's pair counts as the user's choice: it sets anchors too.
- ← restores a photo's original pair; per-photo edit memory would be history (out of scope).
- Pair set during render, not in an effect (same paint; react-hooks 7 rule).
- Neutral start: an empty dark panel, not the Figma mockup pink.
- First photo: no slide, no preview, quick fade; the colours still fade in.
- Download tracking fires on show, not on buffer.
- Visible fallback pair if the first batch fails.

**Layout and controls**
- Dock is two equal halves; the contrast method switch is pinned to the screen centre.
- Score is a plain toggle (white text when open), not a selected box.
- Level buttons are flat `well` fills (no inner shadow).
- The slider panel, levels and export can all be open at once.
- Photo arrows appear twice (on the photo and in the dock) and do the same thing.
- No CLOSE button on the slider panel; clicking the active picker again closes it.
- Channel readout shows on hover and focus as well as change.
- Grip expands on hover of the whole slider row.
- Button outlines drawn inside, so buttons never grow.
- Focus ring softened to white 20%.
- Pickers and swap 4px apart.
- Two bars switched by CSS, not JS.
- Mobile: photo crossfades (not a vertical slide); the photo shrinks before the colour panel; layout switches on width only.

**Text and fonts**
- Shrink to fit (96 → 16px), not fixed size + clip. 100-character limit.
- Menu names in the UI font, not each font's own.
- Sample text dims to 65% on hover.
- Default specimen font Departure Mono.
- No web font licences (owner's use only).

**Share and export**
- Font is in the share link; no `swap` param; defaults left out; the address bar is never updated.
- Labels `DOWNLOAD .MD`, `COPIED`.
- Export: COPY URL, DOWNLOAD .MD, CLOSE (no COPY HEX). One toggle whose label rolls; options pop out together.
- `/` renders per request (reads `searchParams`).

**Motion**
- CSS only, no GSAP. Text roll: live while fast, roll only single changes. Panel fade overlaps the grow (fine for now).

**Project**
- Same stack as MDS, minus opentype.js. Built from scratch. Domain stays `colour-shift.vercel.app`.
- In-UI dev tools (DialKit, Agentation) removed at step 8; tuned values are constants.
- iOS comes next, as its own SwiftUI project using this site's `/api/photos`.

---

## 19. Constraints and rules

**Architecture**
- One page. No routes besides `/` and `/api/photos` (plus the icon metadata routes).
- All state in `ColorShift`. No state library, no context.
- All colour math in `color-engine.ts`.
- Small reusable pieces in `components/ui/`; layouts combine them and don't edit them for layout tweaks.
- The Unsplash key stays on the server; the browser only talks to `/api/photos`.

**Style**
- Tokens only; no raw hex in components. Inline colour only for state (§11.4).
- Dark, quiet chrome; only the pair and the photo carry colour.
- UI labels uppercase; score text keeps its own case (it's data).
- CSS-only motion; no horizontal motion on mobile; respect reduced motion.

**Unsplash**
- Credit every photo, UTM links, download tracking on use (§7.5).

**Process**
- Plan before code; one build step at a time; check in the browser; `pnpm lint` + `pnpm build` before every commit; docs updated in the same commit as the change.
- Use `CONTEXT.md` terms in code and docs.
- Don't copy MDS's code. Delete abandoned experiments. Don't build ahead.
- Never expose the key (client code, logs, commits, `NEXT_PUBLIC_`).

---

## 20. Out of scope

Embed mode, the locked display/showcase mode, social preview images, photo uploads, searching Unsplash by theme, generated palettes, saved collections, history/undo (a user idea; needs a spec change first), Shift Nudge wiring (base path, `shift_nudge` UTM tags, embed messaging, favicon), and extra features before the core is done.

---

## 21. Known gaps

Things that aren't finished or aren't built yet.

- **No automated tests.** The engine (`reachLevel`, `pickPair`, `maxChroma`, truncation) and `parseShare` have only been checked by hand in node. The iOS plan (`ios.md` §15) has parity fixtures generated from the real TypeScript, which would also give the web app a test suite.
- **The address bar tint isn't set.** There's no `theme-color` meta or `viewport.themeColor`. (The style guide says so.)
- **No automatic retry** after a failed buffer top-up; the next → at the end of the stream retries.
- **`VIVID_WEIGHT` (2) is a first guess.** Raise it if pairs lean too much on near-black backgrounds.
- **Landscape phones are cramped** (they get the desktop layout at 640px and wider).
- **Placeholder favicon and home-screen icon.**
- **Figma `bottom bar` internals** still have `Frame 3x` names and hidden leftovers.

---

## 22. Known quirks and tech debt

Things that work as intended, or were seen and accepted. Don't "fix" a quirk without asking; several were deliberate trade-offs.

### 22.1 Accepted behaviour

- **Truncation and floating point.** `Math.trunc(value × 100) / 100` can under-report by one last digit when the multiplication lands just below a whole number (a true 1.15 shows `1.14`). It never over-reports, so the "never look like a pass you aren't" invariant holds.
- **Share links round OKLCH edits** to 8-bit hex, so an OKLCH-edited colour reopens very slightly different.
- **Score reads `Fail 1.00:1`** until the first pair arrives (the start colours are equal).
- **Dock swatches, hex and score** roll or snap while the colour panel fades (exact data first).
- **Photo credit is faint on light photos** (fine for now).
- **A drag's first change** may start a roll before the settle check (`ROLL_SETTLE_MS`: changes under 300ms apart show instantly) cuts it off. Not seen as a problem yet.
- **A longer leaving value** spills briefly into the button padding while it rolls out.
- **Desktop photo arrows jump left** when the export options open (not animated).
- **Rapid ← → mid-slide** drops the older leaving photo abruptly.
- **The buffer counts photos ahead, not unseen ahead,** so after walking back, Space may need a fetch (it handles it).

### 22.2 Tech debt

- `CONTRAST_METHODS` is defined twice (`dock.tsx` and `bottom-bar.tsx`).
- `ExportControls` lives in `dock.tsx` but is shared with `bottom-bar.tsx`.

### 22.3 Implementation notes

- Both bars are mounted on every screen size, so both compute the contrast and render; the hidden one is `display: none` (out of the accessibility tree). Deliberate (§12).
- OKLCH sliders are the costliest render: each of the 3 gradients is 13 `setChannel` calls, each running a 20-step `maxChroma` search. `reachLevel` runs ~101 samples plus 24 bisection steps per crossing, each with a `maxChroma` search. All fast enough in practice.
- `pickPair` scores culori objects directly (not hex), unlike `getContrast`. Fine: photo colours from node-vibrant are already 8-bit.

---

## 23. Documentation drift log

Places where the docs no longer matched the code. Each was fixed in the doc, not the code.

**2026-10-05, found while writing this map:**

| Doc | Said | Code does | Fixed to |
|---|---|---|---|
| Style guide, colour tokens | 10 tokens | 17 tokens | Added `surface-control`, `text-value`, `track-edge`, `grip`, `grip-edge`, `grip-glass`, `grip-glass-edge` |
| Style guide, Details | Safari address bar tint follows the background | No `theme-color` set anywhere | Marked "not built yet" (§21) |
| Style guide, Dock | Gaps 4–16px | Up to 24px (`gap-6`) | 4–24px |
| Style guide, Button | `p-2` only | Icon buttons `px-2 py-1.5` | Icon padding added |
| APP-SPEC, Controls | Channel readout shows while dragging or keyboard-adjusting | Also on hover and focus (step 7 decision) | Updated |
| APP-SPEC, Photos | "Tiny blurred/pixelated preview" | Blurred 200px copy; none for the first photo | Updated |
| APP-SPEC, Photos | Colours crossfade "at the same time" as the photo | Colours start 100ms after it | Updated |
| CLAUDE.md, Mobile stage | `minmax(--colour-panel-min, 1fr)` | Literal `160px` (the variable went with DialKit) | Updated |
| CONTEXT.md, Pair | Only "shown together" | `Pair` also names a photo's pair, the anchors, the shared pair | Definition widened (§6.1) |

---

## 24. What's next

**Required (blocks closing step 8)**
- Apply for Unsplash production access, with the live URL + screenshots (the demo key allows 50 requests/hour).
- Owner's browser check of the live site (desktop Chrome + iPhone share sheet): not reported yet.

**Owner setup (no code)**
- Install Alpha Lyrae and Ghost Byte on the Mac, so they show on the live site there.

**iOS handoff (written; decisions open)**
- `ios.md` (repo root) pulls together the nine research reports in `docs/research/` into one handoff for the separate native repo. It replaces the earlier `docs/port/` plan. Its §14 decision register lists what the owner must choose before Swift work starts (minimum iOS, APCA licence, Input Mono, API v1 shape, tracking trigger, device scope).
- **Font licences to re-check:** the fonts research found Alpha Lyrae and Ghost Byte are SIL OFL, not licensed. If confirmed, ADR 0002, CLAUDE.md and §14 of this map are wrong about them, and the website could serve them like Departure Mono. Verify the licence files before changing anything.

**Future project (not this repo)**
- iOS app: its own project and spec, SwiftUI, using this site's `/api/photos` so the Unsplash key stays on the server.

**Ideas parked (need a spec change first)**
- Undo / history of earlier pairs (SPEC lists history as out of scope).
