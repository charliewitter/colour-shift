# Colour Shift

One-page web app for finding new colour pairings from random Unsplash photos, with contrast scoring and slider fine-tuning. Full spec: `SPEC.md` (what to build). Build rules + behaviour: `APP-SPEC.md`. Look + motion: `COLOUR-SHIFT-STYLE-GUIDE.md`. Read all three before planning any work. Also read `CONTEXT.md` (glossary: use its terms in docs and code), the top entry of `docs/LOG.md` (latest handoff), and `docs/adr/` (decisions and why).

Design: [Figma, Colour Shift](https://www.figma.com/design/IFKpGTC3reLa2GWP6go6KH/Colour-Shift?node-id=0-1). Source of truth for visuals (desktop frames, and the `mWeb` section for mobile); wins over the style guide where they differ. Mockup contrast values are illustrative only.

Reference project: `../color-shift` (by MDS). Use it for reference only; don't copy code from it.

## Communication

When reporting information to me, be extremely concise and sacrifice grammar for the sake of concision. Exception: the teaching parts below are written in plain, full sentences.

## Teaching

This is my first project run like this; I'm learning as we go.

- **Plans** include a "What's going on" section: 2–4 plain-language points on why the step is shaped this way.
- **After each step**, add a "Worth knowing" note: the 1–2 ideas from the step that will come up again.
- **Checkpoints for me:**
  - Have me run the key commands myself instead of running them silently: `pnpm dev` in its own Terminal (see Architecture), one-off commands with `!`.
  - Tell me what to look for when I check in the browser.
  - Point me to one small file to read and explain it.
- **Going deeper:** if a topic is worth more than a quick note, offer to send it to my learning space with the `learn` skill rather than derailing the build.
- Don't explain things I've clearly already got. Keep each note short.
- **Explanations (incl. answers to "what do you mean?"): a few short bullets, one line each.** No long breakdowns unless I ask for more.

## How we work

- Plan before code. Present a plan for each build step and wait for my approval before writing code.
- Build one step at a time, following the build order in `SPEC.md`. Check each step in the browser before moving on.
- Make small commits with clear messages (`feat:`, `fix:`, `style:`, `docs:`).
- Keep this file current. Update it when a decision is made or the structure changes.
- End of each step or session: add an entry to the top of `docs/LOG.md` (done, decided, loose ends, next) in the same commit as the work.
- New term, or a term used inconsistently → update `CONTEXT.md` straight away. Hard-to-reverse, surprising trade-off → new ADR in `docs/adr/`.

## Stack

Next.js 16, React 19, TypeScript, Tailwind v4 (config lives in `globals.css`), pnpm, culori, apca-w3, node-vibrant. No GSAP; use CSS transitions only.

No dev tools in the UI: DialKit and Agentation were used for tuning and feedback during steps 6–7, removed at step 8 (tuned values are plain constants now).

> **Next.js 16 has breaking changes.** APIs differ from training data. Before writing Next-specific code, read the relevant guide in `node_modules/next/dist/docs/`.

## Environment

- `UNSPLASH_ACCESS_KEY` in `.env.local` (never commit it or print its value)
- Deploys to Vercel at the site root (no basePath)
- **Fonts** (ADR 0002): Input Mono, Alpha Lyrae and Ghost Byte are licensed: never committed or uploaded. Their `@font-face` tries `local()` first (a copy installed on the viewer's machine, so the live site shows them to the owner), then `/fonts/…` (gitignored, local dev only), else a free fallback. Departure Mono is SIL OFL: committed in `public/fonts/` with its licence, served to everyone.

## Architecture

```
src/
├── app/
│   ├── api/photos/route.ts # The only server code: Unsplash proxy (?count, ?id, ?download). Key stays here
│   ├── layout.tsx          # Root layout: metadata (title "Colour Shift"), viewport-fit=cover, Google fonts (Geist, Geist Mono, Instrument Serif) as CSS variables
│   ├── page.tsx            # Reads share-link searchParams on the server (parseShare) → <ColorShift shared /> . Makes / dynamic (ƒ)
│   └── globals.css         # Tailwind v4 + tokens (--cs-*) + @theme mapping + @font-faces (Input Mono, Departure Mono, Alpha Lyrae, Ghost Byte) + slide keyframes + reduced motion + base styles
├── components/
│   ├── color-shift.tsx     # Client component holding ALL state: colours + anchors, active colour, colour mode, contrast method, levels open, sample text, specimen font + font menu open, photo stream + index + pairs by photo id. Keyboard (Esc, ← →, Space)
│   ├── stage.tsx           # Colour panel (painted from props; crossfades only for photo pairs; font dropdown top-left) + photo panel
│   ├── sample-text.tsx     # Editable sample text: plaintext contentEditable (uncontrolled), shrink to fit, 100 chars, "Aa" placeholder
│   ├── photo-panel.tsx     # Photo layers (leaving + current) that slide, blurred preview under each, credit, hover arrows
│   ├── slider-panel.tsx    # Colour mode tabs + channel readout (shows on hover/focus/drag, fades 1s after release or leave) + 3 sliders. Shown iff active colour
│   ├── bottom-bar.tsx      # Mobile dock (<640px): swatch row (text · swap · bg, active one 2fr) · levels (stretch) · method switch + score + share
│   ├── dock.tsx            # Desktop only (max-sm:hidden). 2 halves: pickers + swap … method switch | centre | levels + score … photo arrows + export (EXPORT ⇄ COPY URL, DOWNLOAD .MD, CLOSE)
│   └── ui/                 # Small reusable pieces: button, swatch, color-picker, segmented-control, score, levels, slider, dropdown, reveal (panel open/close), roll-text (rolling values)
├── lib/
│   ├── color-engine.ts     # ALL colour math: hex, colour modes + channels, gamut (max chroma), track gradients, contrast, grades, passing level, reachLevel, score text, exportMarkdown, pickPair
│   ├── share.ts            # Share link: shareQuery (defaults left out), parseShare (field-by-field validation), defaults + MAX_TEXT_LENGTH
│   ├── export.ts           # Browser side of export: copyText (execCommand fallback), downloadText (Blob), shareLink (share sheet)
│   ├── fonts.ts            # The 7 specimen fonts: id, label, CSS family with free fallback. Default Departure Mono
│   └── photos.ts           # Browser side of photos: /api/photos calls, Unsplash URL sizing (photoSrc, previewSrc), fetchPhoto (by id), preloadPhoto, download tracking, extractPair (node-vibrant, lazy-loaded)
└── types/
    ├── apca-w3.d.ts        # Hand-written types; apca-w3 ships none
    └── photo.ts            # Photo: what /api/photos returns
public/icons/               # SVG icons downloaded from Figma (committed)
```

- **Tokens:** `--cs-*` in `:root` are the source of truth. `@theme inline` maps them to classes (`bg-canvas`, `bg-surface`, `bg-surface-raised`, `bg-well`, `border-stroke`, `border-border`, `border-swatch-edge`, `outline-focus`, `text-muted`, `text-strong`, `font-ui`). `--color-*: initial` removes Tailwind's default palette, so only token colours exist.
- **Input Mono** is loaded with a plain `@font-face` in `globals.css`, not `next/font/local`. `next/font/local` fails the build when the file is missing; `@font-face` just falls back to Geist Mono (ADR 0002).
- **`AGENTS.md` must stay.** `next dev` writes its Next.js rules block into `AGENTS.md` if that file exists. Otherwise it appends the block to our `CLAUDE.md`.
- **Score display truncates, never rounds** (4.499 shows `4.49`, not a passing-looking `4.50`). Grades use the real value; APCA grades use its absolute value.
- **Colours are culori objects kept in the mode last edited in** (not hex). Hex is derived for display and scoring. Keeps a grey's hue and avoids 0–255 rounding while dragging. OKLCH chroma is capped at the sRGB gamut edge.
- **Anchors** (ADR 0005): `color-shift.tsx` keeps `anchors` beside `colors`. User edits set both; level clicks derive `colors` from `anchors` and never touch them.
- **Dock is two equal halves** split at the screen centre: pickers left, contrast method switch ends 12px left of centre; levels + score start 12px right of centre and grow rightwards. The switch never moves. Score: standard button states, white text while levels are open.
- **Slider** = invisible native `<input type="range">` on top (drag, keys, a11y) + drawn track/grip beneath. Grip centre travels 12px in from each end to match the 24px native thumb.
- **Colours from state** are the one allowed inline `style` colour (stage, swatch). The specimen font is also state, so it's set inline too (`fontFamily`). Chrome colours always use token classes.
- **`transition`** uses the style guide's default timing, set via `--default-transition-*` in `@theme`.
- **Photos are plain `<img>`, not `next/image`.** Unsplash (imgix) resizes via URL params (`photoSrc`); Vercel's optimiser would add cost and a second resize. Extraction reads a 200px copy.
- **A photo's pair sets colours and anchors** (it counts as the user's choice). Pairs are extracted as photos arrive and kept in `pairs` by photo id; the colours follow the current photo's pair *during render* (`pairFor` guard), not in an effect, so photo and pair paint together. ← restores a photo's original pair (edits aren't remembered per photo: that'd be history, out of scope).
- **Buffer:** an effect keeps `PHOTOS_AHEAD` (3) photos past the current one, fetching `PHOTO_BATCH` (3) at a time; it also does the first load. Each arriving photo is preloaded and extracted once (`prepared` ref). Download tracking fires when a photo is shown, not buffered (`shown` ref).
- **Keyboard:** one `keydown` listener via `useEffectEvent`. ← → and Space skip inputs/textareas/contenteditable (so a focused slider keeps its arrows) and modifier keys (Cmd+← stays browser back). Space on a focused button presses the button.
- **Photo slide:** `photo-panel` keeps the outgoing photo in local state (visual-only, set during render) until its `animate-slide-out-*` ends. Direction = stream index up (→, from right) or down (←). Keyframes live in `globals.css` `@theme`. Each layer is keyed by photo id.
- **Preview** = the 200px extraction copy, blurred, under the full photo until it loads (0.4s fade). `crossOrigin="anonymous"` so it's served from the cache node-vibrant filled. The first photo gets no preview: quick 0.2s fade from the dark panel.
- **Colour fade:** `colorFade` in `color-shift` = `"photo"` (0.1s delay + 0.7s, trails the slide), `"step"` (0.2s: swap, level click) or `"none"` (slider drags, instant). Written to `--colour-fade-delay/-duration` on `<main>`; the stage, `Swatch` and the mobile swatch blocks use `transition-colors delay-(…) duration-(…)`. Timings in `COLOR_FADE_MS`. `START_COLORS` is an empty dark panel (text = bg) so the first pair fades in rather than shifting from grey.
- **Reduced motion:** global rule in `globals.css`: transitions 0, animations 1ms (not none, so `animationend` still fires and leaving photos get removed).
- **Space** moves the first unshown photo to just after the current one; if none, fetches a batch and inserts it there. ← always returns.
- **Specimen fonts:** free ones via `next/font/google` (hosted with the site, no layout shift); licensed ones via plain `@font-face` so a missing file falls back instead of failing the build. `lib/fonts.ts` joins both into one list. Licensed monos fall back to Geist Mono, Alpha Lyrae to Geist. opentype.js dropped: the reference only used it for social preview images (out of scope).
- **Dropdown** (`ui/dropdown.tsx`, Figma `font dropdown` + `font menu`): open state lives in `color-shift` (Esc closes it with the other panels). Outside pointerdown closes; ↑ ↓ wrap through `menuitemradio`s; choosing or Esc returns focus to the trigger. Opens with `starting:` (@starting-style) fade + 4px drop; closes instantly.
- **Sample text** (`sample-text.tsx`): uncontrolled `contentEditable="plaintext-only"`; React never renders its children (caret stays put), `onInput` copies text to state, a layout effect copies state in only when it differs (share links). Shrink to fit: binary search 96→16px inside the panel inset 64px, written to `style.fontSize` (a measurement, not state), re-run on text/font/resize/`document.fonts` loadingdone; at 16px a too-long word breaks anywhere. Enter/Esc blur. Selection tint via `--sample-color` + `color-mix`. No focus ring: the caret is the focus state.
- **Share (mobile):** `shareLink` (`lib/export.ts`) → `navigator.share({ files: [.md], url })`, trying `text/markdown` then `text/plain`, then the link alone. Must run straight after the tap (no awaits before it). `"unsupported"` opens the export options in the bottom bar; `"cancelled"` does nothing (ADR 0006). HTTPS only, so test on a Vercel preview, not LAN dev.
- **Vercel:** linked as `duat3/colour-shift` (`.vercel/`, gitignored). `UNSPLASH_ACCESS_KEY` in Preview only so far. Preview: `vercel deploy --target preview` (the bare command made the first deploy Production). `.vercelignore` keeps licensed fonts (all of `public/fonts/` but Departure Mono) and `.env*` out of uploads. Previews are behind Vercel login; test the API with `vercel curl`. Git-connected: pushes to `main` deploy to Production (`colour-shift.vercel.app`, public). Project **paused** until step 8 (production 503); unpause with `vercel api /v1/projects/<id>/unpause -X POST`.
- **Export:** `exportOpen` state in `color-shift` (Esc closes). Confirmation labels are local to `ExportControls` (visual-only), 1.5s, and reserve the longest label's width (`StableLabel`). One toggle button stays put, its label rolling EXPORT ⇄ CLOSE (`RollText`, user); options appear to its left. Focus moves to COPY URL on open, back to the toggle on close. Share URL built on demand from state; Markdown text in `color-engine` (colour formatting), read from on-screen hex.
- **Opening a share link:** state starts from `shared` via `useState` initialisers (no flash of defaults; hex strings cross the server→client boundary, colours made client-side). The shared photo is fetched first (`waitingForShared` holds the random stream), its pair pre-filled with the shared colours and never extracted (so ← restores them). `keepSharedColors` makes the first photo shown skip its pair once, so shared colours survive even if the shared photo fails. Invalid fields are ignored individually; fg/bg only together.
- **Sample text hover:** fades to 65% on hover (reads as editable), full while focused. User.
- **Slider track** uses `bg-origin-border`: otherwise the gradient is sized inside the 1px border and repeats under it.
- **Photo requests go through `requestPhotos`** in `color-shift.tsx`: returns `null` when skipped (one in flight), `[]` when failed. If the first batch fails, `FALLBACK_COLORS` (muted on surface) fade in, only if nothing has set colours yet. Failures `console.warn` (errors pop Next's dev overlay). A ref guard allows one in flight, which also stops dev-mode double effects spending API calls (demo key: 50/hour, ~2 per photo; ~6 calls at start-up).
- **Mobile (<640px, Tailwind `sm`)**: `Dock` (`max-sm:hidden`) and `BottomBar` (`sm:hidden`) are both rendered; CSS picks one, so the server render never flips. Same state, same callbacks. Everything else adapts in place with `max-sm:` (stage rows, sample text inset, dropdown size, photo crossfade, credit). Hover-only things use `pointer-coarse:` (touch), not width: photo arrows always shown, slider touch area +8px above/below. UI text 14px via a `body` media query in `globals.css`.
- **Mobile stage:** rows `minmax(--colour-panel-min, 1fr) minmax(0, 1fr)`: equal until the colour panel hits its minimum (160px), then the photo gives way. Order in the DOM already matches the stack: colour, photo, slider panel, bar.
- **Mobile photo change** crossfades: the new layer `animate-fade-in`, the old one `animate-hold` (stays opaque underneath, so its `animationend` still removes it). Desktop still slides.
- **Swatch hex** is black or white by APCA (`readableOn` in `color-engine`), never the other colour of the pair: stays readable at low contrast.
- **Layout fills `h-dvh`** (visible area, whatever the browser's toolbars are); the bar is last in the flex column; `env(safe-area-inset-bottom)` clears the home bar. `allowedDevOrigins` in `next.config.ts` lets a phone on the LAN use `pnpm dev`.
- **Panels** (`ui/reveal.tsx`): grid row `0fr ↔ 1fr` + opacity + 4px slide; content stays mounted and is `inert` while closed. Slider panel always rendered; `panelRole` (set during render) holds the last active colour so it doesn't blank while closing. Mobile levels: the 16px gap sits inside the panel so it collapses too. Desktop levels: `starting:` fade in, instant close. Export options: `animate-pop-left` on one wrapper (slide left from the toggle, slight overshoot, both together; user), instant close.
- **Rolling text** (`ui/roll-text.tsx`, score, hex, EXPORT ⇄ CLOSE): leaving/current layers (set during render, like the photo panel); the leaving one is absolute, so width follows the new value at once (user), clipped only top/bottom, one `inline-block` span per character with `animation-delay` `ROLL_STAGGER_MS * i`. A layout effect sets `data-fast` when changes come closer than `ROLL_SETTLE_MS` → no animation, leaving layer hidden (live during drags). `whitespace-nowrap` is needed (character boxes allow line breaks). sr-only copy for screen readers. Duration, distance and blur live in the `roll-in`/`roll-out` keyframes.
- **Button outlines** (selected/pressed) are drawn 1px inside (`-outline-offset-1`), so buttons never grow (user; Figma too).
- **Run `pnpm dev` in its own Terminal**, not via `! pnpm dev`: Claude Code moves long `!` commands to the background and stops them when memory runs low.
- **pnpm** 12.6.0 via corepack, installed to `~/.local/bin` (not `/usr/local/bin`, which needs admin rights). `packageManager` in `package.json` pins the version.
