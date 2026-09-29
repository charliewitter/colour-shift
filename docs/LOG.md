# Progress log

Newest first. One entry per session: what got done, what was decided, loose ends, and what's next. The top entry is the handoff for a fresh session.

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
