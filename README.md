# Colour Shift

Find new colour pairings from random Unsplash photos. Each photo gives a text and background colour; the contrast is scored (WCAG or APCA), and you can fine-tune either colour with sliders (OKLCH, HSB, RGB), then share the pair as a link or Markdown.

Live: https://colour-shift.vercel.app

Inspired by MDS's Color Shift; built from scratch.

## Run it locally

Needs Node and pnpm (version pinned in `package.json`), plus an [Unsplash access key](https://unsplash.com/developers).

```sh
pnpm install
echo "UNSPLASH_ACCESS_KEY=your-key" > .env.local
pnpm dev
```

Then open http://localhost:3000.

## Fonts

Input Mono, Alpha Lyrae and Ghost Byte are licensed and aren't in this repo; the app falls back to free fonts (Geist, Geist Mono) without them. Departure Mono is included under the SIL Open Font License (`public/fonts/DepartureMono-LICENSE.txt`).

## Docs

`SPEC.md` (what and why), `APP-SPEC.md` (build rules and behaviour), `COLOUR-SHIFT-STYLE-GUIDE.md` (look and motion), `CONTEXT.md` (glossary), `PROJECT-MAP.md` (the whole codebase in detail), `docs/adr/` (decisions), `docs/LOG.md` (progress log).
