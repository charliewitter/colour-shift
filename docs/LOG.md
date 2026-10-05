# Progress log

Newest first. One entry per session: what got done, what was decided, loose ends, and what's next. The top entry is the handoff for a fresh session.

---

## 2026-10-05: Project map

**Done**
- `PROJECT-MAP.md` (root): the whole web app in detail, written from a full read of the docs and every source file. Covers layout, runtime architecture, state (every `useState`/ref), actions, colour engine (channels, gamut search, WCAG/APCA, `reachLevel`, `pickPair`), `/api/photos`, photo pipeline, share links, export, components, desktop vs mobile, fonts, tokens, motion, a11y, deploy, all decisions, constraints, gaps.
- Doc drift fixed (listed in the map, §21.2): style guide token table (+7 tokens), dock gaps, icon button padding, address bar tint marked not built; APP-SPEC channel readout, preview, colour fade timing; CLAUDE.md mobile stage `160px`.
- CLAUDE.md points to the map; README lists it.
- Revised after outside feedback: §1 now opens with a mental model, core invariants and a "where to change things" table; §4 has diagrams of how `colors`, `anchors`, `pairs` and the share-link flags connect; "pair" defined (map §6.1, CONTEXT.md widened); old §21 split into gaps / quirks and tech debt / doc drift log / what's next (by category); accessibility moved before fonts.
- Cold-read test: a fresh agent read only the committed map and answered 10 questions. It couldn't place the screen layout, didn't know MDS, Shift Nudge, the build steps or DialKit, misread nothing, and found ~15 unclear or contradictory spots. Fixes: new "Before you start" section (screen sketch, terms, names and history); §3 diagram (`page.tsx` moved to the server side); status vs §24 contradiction; `reachLevel` "current" → anchor's lightness; stale "starting pink" given its real hex; "chrome" defined; constants' files named; smaller wording fixes.

**Decided**
- When map and code disagree: code wins on descriptions; the map's invariants win, and a contradiction is a possible bug to raise. User.
- Feedback taken with corrections: two of its "change here" rows were wrong (Markdown is built in `color-engine.ts`, not `export.ts`; photo choice is `route.ts`, pair choice is `pickPair`), and its anchors diagram had slider edits flowing through anchors (they write both). Kept §18.2 (non-ADR decisions), since those were only scattered across the LOG. User.
- Map lives at the root beside SPEC/APP-SPEC. CLAUDE.md keeps its short Architecture notes; the map is the deep reference, updated in the same commit as structural changes. User.
- Map is separate from the proposed iOS port docs (`docs/port/`), which can build on it later. User.

**Loose ends**
- No automated tests (engine checked by hand only).
- Address bar tint (`theme-color`) not built.
- Score truncation can under-report by one last digit via floating point (true 1.15 → `1.14`); never over-reports.

**Next**
- Unchanged from the step 8 entry: Unsplash production access; then the iOS port docs plan (needs approval).

---

## 2026-10-05: Step 8 (deploy), live

**Done**
- Step 7 closed earlier today (see below); pushed, production stayed 503 while paused.
- Fonts: Departure Mono confirmed SIL OFL (its repo's MIT licence covers only the website); official woff2 + licence committed in `public/fonts/` (`.gitignore`/`.vercelignore` now `public/fonts/*` + `!DepartureMono-*`). Input Mono, Alpha Lyrae, Ghost Byte: `local()` first, then the dev-only file, else fallback. ADR 0002 updated.
- DialKit, `motion` and Agentation removed (`pnpm remove`); tuned values now constants (`COLOR_FADE_MS`, roll keyframes, `ROLL_*_MS`, `hover:opacity-65`, 160px).
- Placeholder icons: `app/icon.svg`, `app/apple-icon.tsx` (180px PNG via `ImageResponse`).
- `UNSPLASH_ACCESS_KEY` added to Production (Secret, piped from `.env.local`), project unpaused, pushed. Live: https://colour-shift.vercel.app; `/api/photos` 200 ~1 min after push; Input Mono file 404 as intended.
- Docs brought up to date: CLAUDE.md (live URL, Vercel, fonts), SPEC (status, iOS next, spelling point closed), APP-SPEC, style guide (UI font fallback), README written.

**Decided**
- No web font licences: the site is for the owner's use. Licensed fonts show only where installed (likely Chrome only; Safari may hide user-installed fonts). User.
- Domain stays `colour-shift.vercel.app`. User.
- Remove all in-UI dev tools (DialKit, Agentation). User.
- iOS comes after the web version, as its own native (SwiftUI) project using this site's `/api/photos`.

**Loose ends**
- Unsplash production access: apply with the live URL + screenshots (demo key: 50 requests/hour).
- User browser check of the live site (desktop Chrome + iPhone share sheet) not reported yet.
- Placeholder icon; swap for a real design any time.
- Alpha Lyrae and Ghost Byte not installed on the Mac yet (fallbacks show).
- Never `vercel env pull` (the Production key is a Secret; would rewrite `.env.local`).

**Next**
- Apply for Unsplash production access, then close step 8.
- **Porting docs for iOS** (user wants thorough docs before the Swift port). Plan proposed, not yet approved; location question open (proposed `docs/port/`). Docs: `README.md` (index, what not to port), `behaviour.md` (rules + edge cases per feature), `state.md` (state + action → result, framework-free), `colour-engine.md` (formulas, gamut, WCAG/APCA, truncation, reachLevel, extraction/pickPair, Swift library options), `api-and-links.md` (`/api/photos`, Unsplash rules, share-link format/validation), `design-tokens.json` + `design.md` (tokens, CSS easing → SwiftUI), `ios-mapping.md` (hover/keyboard/share/fonts/photos on iOS; licensed fonts need app licences to bundle), `ios-build-order.md`, `test-vectors/*.json` generated by a script from the real TS (parity tests for Swift). Write without React/CSS terms. Start with `colour-engine.md` + test vectors; one doc at a time, user reviews each.
- Then: iOS project (own spec, SwiftUI, uses this site's `/api/photos`).

---

## 2026-10-01 → 05: Step 7 (motion polish), done

**Done**
- 7A: panels animate both ways. `ui/reveal.tsx` (grid row 0fr → 1fr + fade + 4px slide; closed = `inert`) wraps the slider panel and the mobile levels row. Slider panel stays mounted; `panelRole` keeps the last colour while closing. Desktop levels and export options fade in (`starting:`), close instantly.
- Pickers + swap 4px apart (desktop dock). Selected/pressed outlines moved **inside** (`-outline-offset-1`) so buttons keep their size; Figma updated by user.
- 7B: colour fade speeds (`colorFade`: photo 0.1s + 0.7s / step 0.2s for swap + level / none for drags) via `--colour-fade-*` on `<main>`; stage, desktop swatches and mobile swatch blocks all follow.
- 7C: `ui/roll-text.tsx`: score and hex values roll per character, left to right (stagger), on single changes; changes closer than "settle" show instantly (live during drags). Tuned by user: 300ms, 55%, 0.5px blur, 12ms stagger, 300ms settle.
- DialKit "Colour panel" baked: sample text hover 0.65, mobile min height 160. "Colour fade" kept as is (user).
- EXPORT ⇄ CLOSE is now one toggle button whose label rolls. Rolling text's leaving layer is absolute, so width follows the new value at once (fixes the score box snap too).
- Export options pop out to the left together (slide + slight overshoot), close instantly (user).
- Desktop dock controls centred vertically (`px-4`, was `p-4`): 28px buttons had 16px above, 12px below. Style guide updated.
- Channel readout also shows on slider hover and focus, so you can see what a slider is before changing it (user).
- Style guide Motion section rewritten: rules, timing table, one line per animated piece, reduced motion.

**Decided**
- Text roll: live while changing fast, roll only single changes (not hold-then-roll). User.
- Panel fade (200ms, overlaps the grow) is subtle but fine for now. User.
- Explanations to the user: short bullets (CLAUDE.md). User.
- Motion rules (style guide): live input instant; menus and inline options open softly, close instantly; layout panels animate both ways; small distances; colours trail the photo.
- Export options move together, not staggered (reads as one group). User.

**Loose ends**
- A drag's first change may start a roll before "settle" cuts it off (not reported as visible yet).
- A longer leaving value spills briefly into button padding while rolling out (accepted).
- ~~Not pushed yet~~ Pushed 2026-10-05; production stayed 503 while paused.
- Desktop photo arrows jump left when export options open (not animated; not reported as a problem).

**Next**
- Step 8: deploy. Plan first: Production Unsplash key, unpause, font web licences + how files reach Vercel, DialKit removal decision.

---

## 2026-10-01: Step 6 (mobile layout)

**Done**
- Mobile design review over three rounds (Figma `mWeb`). Frames renamed to their states; `bottom bar` variant property renamed to `state`.
- 6A: below 640px the stage stacks (colour panel on top, keeps a 160px minimum so the photo shrinks first) and `BottomBar` replaces the dock: swatch row (black/white hex by APCA, active colour 2fr), full-width levels, method switch + score + share. Photos crossfade on mobile; arrows always show on touch (`pointer-coarse`); short credit top-left; 40px controls, 28px slider touch area, 14px UI text; `viewport-fit=cover` + safe-area padding.
- 6B: share button opens the native share sheet with the link + `.md` (`shareLink`); falls back to the export options. ADR 0006.
- Vercel project created and linked (`duat3/colour-shift`); `UNSPLASH_ACCESS_KEY` added to Preview only; `.vercelignore` keeps licensed fonts and `.env*` out of uploads. Preview checked on iPhone by the user (layout, share to Messages/Files).

**Decided**
- Photo crossfade on mobile, not a vertical slide (the ← → arrows would contradict it). User.
- Native share sheet with link + `.md`; own menu only as fallback. User.
- Swatch hex in black or white, not the pair's other colour. User.
- Photo shrinks before the colour panel. User.
- Layout switches at 640px wide only; landscape phones get desktop for now. User.
- Two bars switched by CSS (not JS), so the server render never flips.

**Loose ends**
- **Project is Git-connected: every push to `main` deploys to Production**, and `colour-shift.vercel.app` is public (Vercel login doesn't cover the production domain on this plan). Production has no Unsplash key yet, so the project is **paused** (production returns 503; previews unaffected). Step 8: add the key to Production, unpause, deploy. Check after the next push that it stays paused.
- Photo credit on light photos is faint (user: fine for now). Landscape phones are cramped (step 7?).
- Figma `bottom bar` internals still have `Frame 3x` names and hidden leftovers.
- iOS app: later, after deploy. Options: PWA (home-screen), Capacitor (wraps this code), SwiftUI (rewrite).

**Next**
- Step 7: motion polish. Mobile minimum height (DialKit) worth tuning on the phone.

---

## 2026-10-01: Dev tools (DialKit, Agentation)

**Done**
- DialKit 2.0.2 (+ motion 13.4.6 as its peer): `<DialRoot>` in `color-shift.tsx`; "Colour panel" controls in `stage.tsx` for crossfade delay/duration and sample text hover opacity.
- Agentation 3.1.2 (dev dependency): dev-only toolbar, halfway up on the right.
- Lint, types and `pnpm build` pass (build run by the user: auto mode blocks the agent from building right after installing new third-party code).

**Decided**
- Both are dev tools; app motion stays CSS-only. User.
- Agentation moved off the dock's corner to halfway up the right. User.

**Loose ends**
- Before deploy (step 8): bake tuned DialKit values into code and decide whether to remove DialKit (and `motion`) from the bundle.
- Agentation's own keyboard shortcuts aren't documented; turn them off (`enableKeyboardShortcuts={false}`) if they clash with ← → Space.

**Next**
- Unchanged: step 6 (mobile layout), waiting on the user's mobile Figma designs. See the step 5 entry for the brief.

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
- Step 6: mobile layout. **Waiting on the user's mobile Figma designs** before planning (Figma is the source of truth). When they share the link/node IDs, read them with the Figma MCP (load `skill://figma/figma-design-to-code/SKILL.md` first), then plan.
- Frames requested (390px wide, desktop layer names reused: `stage`, `dock`, `slider panel`…), in priority order: 1) resting, 2) slider panel open, 3) score levels open, 4) export open, 5) font menu open (if different).
- Open questions the designs should answer: how the one-row dock fits at 390px (the main problem); stage split and proportions (APP-SPEC: photo on top); photo arrows with no hover (always visible, dock only, or vertical swipe); sample text inset (64px on desktop, too much); photo change motion must be vertical on mobile (style guide).
- Session habits that worked: plan → approve → build in two parts (A/B) with a browser check and commit each; user runs `pnpm dev` in its own Terminal and `git push` via `!`; offer `/learn` for bigger ideas (sent so far: React setting state during render).

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
