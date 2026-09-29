# Progress log

Newest first. One entry per session: what got done, what was decided, loose ends, and what's next. The top entry is the handoff for a fresh session.

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
- Mobile start: photo on top, then the colour panel, with the dock pinned to the bottom. Not designed yet.
- "Colour" for people, "color" in code (ADR 0003). Licensed fonts local-only (ADR 0002).

**Loose ends**
- Web licences for the fonts before deploying (step 8).
- Licences for Departure Mono, Alpha Lyrae and Ghost Byte to check at step 4.

**Next**
- Step 0: project setup. Plan first and wait for approval.
