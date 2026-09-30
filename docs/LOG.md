# Progress log

Newest first. One entry per session: what got done, what was decided, loose ends, and what's next. The top entry is the handoff for a fresh session.

---

## 2026-09-30: Step 5 (copy, share link and export)

**Done**
- 5A: EXPORT in the dock opens COPY URL, DOWNLOAD .MD, CLOSE (Figma `export`). Copy uses the Clipboard API with an `execCommand` fallback; labels confirm for 1.5s (`COPIED`, `DOWNLOADED`) at a fixed width. Markdown: both colours (hex, RGB, OKLCH), score, share link, photo credit.
- 5B: `page.tsx` reads the share link on the server, so the first render already shows it. Shared photo first, shared colours kept, bad fields ignored one by one.
- Fix: slider gradients reach both ends of the track (`bg-origin-border`).
- Sample text fades to 50% on hover.
- Browser checks (user) passed.

**Decided**
- **Font in the share link** (`font=`). User.
- **No `swap` param:** swap exchanges the colours, so fg/bg already record it. User.
- **Address bar never updated**; links built only when copied. User.
- **Defaults left out of links** (WCAG, Departure Mono, "Aa").
- **Labels:** `DOWNLOAD .MD` (Figma updated by user), `COPIED` rather than `COPIED URL` (similar length). User.
- **`/` is now rendered per request** (reading `searchParams`), not prebuilt.

**Loose ends**
- Font files still to copy into `public/fonts/` (see step 4 entry).
- Share links carry 8-bit hex, so an OKLCH-edited colour reopens very slightly rounded. Fine for now.
- A share link costs ~7 Unsplash calls on open (1 by id + buffer).

**Next**
- Step 6: mobile layout.

---

## 2026-09-30: Step 4 (sample text and fonts)

**Done**
- 4A: seven specimen fonts (`lib/fonts.ts`). Geist, Geist Mono, Instrument Serif via `next/font/google`; Departure Mono, Alpha Lyrae, Ghost Byte via local-only `@font-face` with Geist fallbacks. Font dropdown + menu top-left of the colour panel per Figma (new token `--cs-surface-control` #212121), outside click / ↑ ↓ / Esc, `@starting-style` open.
- 4B: editable sample text, shrink to fit (96→16px), 100-char limit, "Aa" when empty, selection tint, Enter/Esc stop editing.
- Unsplash failures: `console.warn` and a visible fallback pair if the first batch fails.
- Browser checks (user) passed for 4A and 4B.

**Decided**
- **Shrink to fit** rather than fixed size + clip. User.
- **100-character limit.** User.
- **opentype.js dropped** (only for social previews, out of scope). Docs updated. User.
- **Menu names in the UI font**, not their own font (Figma).
- **Fallback pair** when photos can't load. User.

**Loose ends**
- **Font files not yet copied** into `public/fonts/` (Departure Mono, Alpha Lyrae, Ghost Byte): `cp ../color-shift/src/fonts/{DepartureMono-Regular.woff2,AlphaLyrae-Medium.woff2,GhostByte-Regular.woff} public/fonts/`. Fallbacks show until then.
- Font licences unchecked (ADR 0002 update). Departure Mono may be OFL.
- Demo key hit its 50/hour limit during testing (403, `x-ratelimit-remaining: 0`). ~6 calls per reload. Apply for production access at step 8, or earlier if it keeps blocking.
- The specimen font isn't in the share URL spec. Decide at step 5.
- Sample text inset (64px) is a desktop value; revisit at step 6.

**Next**
- Step 5: copy, share link and export.

---

## 2026-09-30: Step 3, part B (photo stream feel)

**Done**
- Buffer: 3 photos kept loaded ahead, fetched 3 at a time. Each is preloaded and its pair extracted on arrival, stored by photo id, so a photo and its pair show together. Tracking fires on show, not on buffer.
- Keyboard: ← → step, Space jumps to an unseen photo inserted after the current one (fetches if none). Skipped in inputs (so a focused slider keeps its arrows), with modifier keys, and Space on a focused button.
- Photo slide (0.6s, direction follows the stream), blurred preview under each photo, colour crossfade only for photo pairs.
- Global reduced-motion rule.
- Browser check (user) passed for B1 and B2's motion.

**Decided**
- **← restores a photo's original pair.** Remembering edits per photo would be history (out of scope). User.
- **Neutral start:** empty dark panel instead of the pink mockup pair. User.
- **First load snaps the photo** (no preview, quick fade); the colours still fade in. User found the full sequence too prominent.
- **Softer crossfade:** 0.1s delay + 0.7s, so colours trail the slide. Style guide updated. User.
- **Pair set during render, not in an effect** (react-hooks 7 flags setState in effects; also avoids a one-frame lag).

**Loose ends**
- Dock swatches/hex/score snap while the colour panel fades. Left as is (exact data).
- Score reads `Fail 1.00:1` until the first pair arrives (start colours are equal).
- Rapid ← → mid-slide drops the older leaving photo abruptly; fine so far.
- Buffer counts photos ahead, not *unseen* ahead, so after walking back Space may need a fetch (it handles it).
- `VIVID_WEIGHT` still a first guess. Demo key 50/hour: start-up now ~6 calls.
- Mobile needs vertical motion (step 6).

**Next**
- Step 4: sample text and fonts.

---

## 2026-09-30: Step 3, part A (photos and pairing)

**Done**
- `/api/photos` route handler: `?count` (one random photo per shuffled search word, 40 words, max 10), `?id` (for share links), `?download` (Unsplash tracking). UTM `colour_shift`. Key never leaves the server.
- Engine: `pickPair` scores every pair of photo colours on `log(contrast) + 2 × (chroma of both)`, needs ≥ 1.5:1 when possible, darker colour as background. A single colour pairs with black or white, whichever contrasts more.
- `lib/photos.ts`: Unsplash URL sizing (1600px display, 200px extraction), fetch, download tracking, `extractPair` (node-vibrant, loaded on first use).
- Photo panel per Figma: photo fills the half, credit bottom-right (`text-value`), 40px arrows on hover/focus. Dock ← → before where EXPORT will go. Arrow icons from Figma.
- State: `photos` + `photoIndex`. → steps forward, fetching a batch of 3 at the end; ← steps back. Each photo's pair sets colours and anchors. Tracking fires once per photo.
- Checked in node: sunset, fog, neon and single-colour palettes give sensible pairs. Browser check (user) passed; dev log shows fetches and tracking returning 200.

**Decided**
- **Focus ring softened** to white 20% (was 30%). User.
- **Plain `<img>` for photos**, not `next/image` (Unsplash already resizes; Vercel's optimiser would cost more).
- **No `orientation=landscape`**: the photo panel is nearly square or taller, so landscape photos lost too much to cropping.
- **Download tracking moved into part A** from B: a few lines, and an Unsplash requirement.
- **New term: Photo colour** (not "swatch", which is the picker square). Engine type `PhotoColor`.
- **Run `pnpm dev` in its own Terminal.** `! pnpm dev` gets moved to the background by Claude Code and stopped when memory is low; that is what broke the browser view twice.

**Loose ends**
- Pink mockup pair shows until the first photo's pair arrives. Part B's preview/crossfade should cover it.
- `VIVID_WEIGHT` (2) is a first guess. Raise it if pairs lean too much on near-black backgrounds.
- Demo Unsplash key: 50 calls/hour, ~2 per photo. Apply for production access before deploying (step 8).

**Next**
- Step 3, part B: buffer of ~3 photos ahead with palettes pre-extracted, keyboard ← → and Space, blurred preview then full photo, photo slide + colour crossfade.

---

## 2026-09-29: Step 2, part B (levels)

**Done**
- Engine: `getPassingLevel`, `formatLevel`, `reachLevel` (sample 101 lightnesses, bisect each pass/fail crossing keeping the passing side, take the crossing nearest the current lightness; out of reach → the stronger end). `getGrade` reuses `getPassingLevel`. `Role`/`Pair` types moved into the engine.
- Score is a button that opens/closes the levels (selected look while open). Levels: recessed `well` buttons, passing level raised. Clicking moves the active colour, or the text colour if none. Esc closes levels too.
- Checked in node: every WCAG and APCA level lands on or just above target with hue kept; APCA 90 on mid-grey stops at Content Lc -68.5. Browser check (user) passed.

**Decided**
- **Contrast method switch is pinned to the screen centre** (user request). Dock is two equal halves; the switch ends 12px left of centre and the levels and score start 12px right of it (24px gap centred on the page), growing rightwards, so nothing to its right can move it. Replaced an interim fix (a fixed-width score slot), which is no longer needed.
- **Score is a plain toggle, not a selected button** (user redesign in Figma). Muted at rest, hover fill, pressed outline like other buttons; white text while the levels are open, no box.
- **Level buttons lost their inner shadow** (user; removed in Figma too). Flat `well` fill.
- **Levels move from an anchor colour** (ADR 0005, new CONTEXT term). Repeated level clicks were compounding gamut clamps and washing colours out to grey (90 → 30: `#907478` before, `#d2456b` after). From user feedback.

**Loose ends**
- Focus ring looked too bright to the user (it shows on the last-clicked button after pressing Esc/Tab: `:focus-visible` heuristics). Proposed: soften `--cs-focus` from white 30% to 20%. Not decided yet; ask the user. Rejected options: matching `stroke` (≈1.9:1, too faint for keyboard users), blurring on Esc (loses keyboard place).

**Ideas for later**
- Undo / history of earlier pairs (user idea). Out of scope in SPEC ("saved collections or history"), so it needs a spec change first; revisit after step 8.

**Next**
- Step 3: Unsplash photos and palette extraction. Plan first.

---

## 2026-09-29: Step 2, part A (active colour and sliders)

**Done**
- Engine: colours as culori objects in their last-edited mode; `CHANNELS` for OKLCH/HSB/RGB; `getChannel`/`setChannel`; gamut-capped OKLCH chroma (`maxChroma` binary search); live track gradients; contrast now scores the displayed hex.
- Colour pickers are buttons with the active state; same one again closes, other switches, swap keeps the value active. Esc closes.
- Slider panel per Figma: mode tabs (Button selected), channel readout (fades ~1s after release), three sliders with 8px grip → 24px glass on hover/drag.
- New tokens: `text-value`, `track-edge`, `grip`, `grip-edge`, `grip-glass`, `grip-glass-edge`.
- Checked in node: mode switch keeps hex, grey keeps hue, chroma follows gamut edge. Browser check (user) passed.

**Decided**
- Default colour mode HSB (user choice; Figma shows HSB).
- Track gradients are live (other channels held), not Figma's pure spectrum.
- Grip expands on hover of the whole slider row, not only the grip.

**Next**
- Part B: levels (score opens levels; clicking one moves lightness until the pair just reaches it).

---

## 2026-09-29: Step 1 (two colours and a contrast score)

**Done**
- Step 0 committed after browser check; guided read of `globals.css`.
- `color-engine.ts`: `getContrast` (culori WCAG, apca-w3 APCA), `getGrade`, `formatScore`, `LEVELS`. Hand-written `types/apca-w3.d.ts`.
- State in `color-shift.tsx` (text colour, background colour, contrast method). Starting pair #ff6f91 on #3a1020 (Figma's mockup pair).
- Colour panel painted from state. Dock per Figma `dock` (panel=none): colour pickers + swap | WCAG/APCA switch + score | empty right column.
- `components/ui/`: button, swatch, color-picker, segmented-control, score. Swap icon downloaded from Figma to `public/icons/repeat.svg`.
- Tokens `swatch-edge` and `focus` added; default transition timing set in `@theme`.
- Checked: black/white = 21:1 and Lc 106.04 / -107.88. Lint, build, and browser check (user) all pass.
- Contrast formulas note sent to the learning inbox.

**Decided**
- Levels moved to step 2: clicking a level needs the gamut/colour-mode code step 2 builds anyway.
- Score display truncates, never rounds (4.499 must not show as a passing 4.50). Grades use the real value; APCA grades use its absolute value.
- APCA score shows the signed Lc (negative = light text on dark).
- Swatch border follows Figma (0.5px, white 30%, on every colour), not the old style-guide rule (1px, 10%, light/dark). Style guide updated.
- Dock is a `1fr auto 1fr` grid so the contrast controls stay centred as the sides fill up.
- Colour pickers are display-only until step 2 (active colour).

**Loose ends**
- None.

**Next**
- Step 2: sliders, colour modes, active colour, levels. Plan first.

---

## 2026-09-29: Step 0 (project setup)

**Done**
- pnpm 12.6.0 installed via corepack into `~/.local/bin` (`/usr/local/bin` gave a permissions error).
- Next 16.3.7 generated in a temporary folder, then merged in without touching our docs. The temporary folder is deleted.
- Tokens, `@theme` mapping and base styles in `globals.css`. Input Mono via `@font-face`, Geist Mono fallback via `next/font/google`.
- `color-shift.tsx` → `stage.tsx` (50/50 grey placeholders, "Aa") + `dock.tsx` (56px, empty). Title "Colour Shift". Starter SVGs and favicon removed.
- `pnpm lint` and `pnpm build` both pass. The token classes are in the built CSS, and the default Tailwind palette is gone.
- CLAUDE.md Architecture section filled in.
- Browser check passed (user): 50/50 halves, 56px dock, no scrollbars, tab title, Input Mono rendering.

**Decided**
- Input Mono uses a plain `@font-face`, not `next/font/local`, which would fail the build without the licensed file.
- Keep `AGENTS.md`: `next dev` otherwise writes into our CLAUDE.md.
- Tailwind's default colour palette removed (`--color-*: initial`), so only tokens exist.
- Text token classes are `text-muted` / `text-strong`, mapped from `--cs-text-muted` / `--cs-text-strong`.
- Geist Sans dropped for now; it returns as a specimen font in step 4.

**Loose ends**
- `pnpm dev` from Claude's `!` shell runs in the background; prefer a separate terminal tab. Next 16 refuses a second dev server for the same folder.

**Not yet done (pick up here)**
1. Guided read of `src/app/globals.css` with the user (teaching checkpoint).
2. Then a Tailwind `/teach` session (the note is in `~/GitHub/learning/inbox`). A TypeScript note is also there for after step 1.

**Next**
- Step 1: two colours and a contrast score. Plan first.

---

## 2026-09-28 → 29: Figma review and doc alignment

**Done**
- Read the Figma file end to end; renamed its components to clearer names (`stage`, `dock`, `slider panel`, `grip`, `channel readout`…).
- Brought SPEC, APP-SPEC, the style guide and CLAUDE.md in line with the Figma desktop design.
- Added `CONTEXT.md` (glossary) and the first ADRs in `docs/adr/`.
- Input Mono Regular/Bold copied into gitignored `public/fonts/` for local use.
- Deleted `FIRST-PROMPT.md` and `FIGMA-MAKE-PROMPT.md`.

**Decided**
- Figma wins over the style guide (ADR 0001). Tokens updated: `surface-raised #262626`, `stroke #3e3e3e` 80% outside, `text-strong #ffffff`, new `well #000000`.
- Photo arrows appear twice (on the photo on hover and in the dock), both doing the same thing.
- The slider panel opens only when there's an active colour; clicking its colour picker again closes it; no CLOSE button.
- The channel readout shows while a slider is in use, then fades ~1s after release.
- The grip expands on hover and while dragged. The glass effect is approximated in CSS.
- Levels: WCAG 1.5/3.0/4.5/7.0, APCA 30/45/60/75/90. The passing level is highlighted. Choosing a level moves the active colour (or the text colour) until the pair reaches it. Official grade labels (ADR 0004).
- Score levels and export can be open at the same time; the code treats them as independent, even though Figma's `dock` has one `panel` variant.
- The photo arrows are their own piece in code, not part of export.
- 7 specimen fonts, default Departure Mono. Sample text starts as "Aa". Space and arrow shortcuts are off while editing text.
- Export: COPY URL, DOWNLOAD .MD, CLOSE (no COPY HEX).
- Swap keeps the same colour value active, now in its new role.
- A level that can't be reached: the colour moves as far as it can, and the score shows the real value.
- Figma contrast components renamed to glossary terms: `contrast controls`, `contrast method switch`, `contrast method tab`, `score`, `levels`.
- Mobile start: photo on top, then the colour panel, with the dock pinned to the bottom. Not designed yet.
- UI font fallback is Geist Mono (free, and already one of the specimen fonts).
- Teaching mode: plans explain why, each step ends with a "Worth knowing" note, I run key commands and check the browser myself, deeper topics go to the learning inbox. Explanatory output style on.
- "Colour" for people, "color" in code (ADR 0003). Licensed fonts local-only (ADR 0002).

**Loose ends**
- Web licences for the fonts before deploying (step 8).
- Licences for Departure Mono, Alpha Lyrae and Ghost Byte to check at step 4.

**Next**
- Step 0: project setup. Plan first and wait for approval.
