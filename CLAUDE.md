# Colour Shift

One-page web app for finding new colour pairings from random Unsplash photos, with contrast scoring and slider fine-tuning. Full spec: `SPEC.md` (what to build). Build rules + behaviour: `APP-SPEC.md`. Look + motion: `COLOUR-SHIFT-STYLE-GUIDE.md`. Read all three before planning any work. Also read `CONTEXT.md` (glossary: use its terms in docs and code), the top entry of `docs/LOG.md` (latest handoff), and `docs/adr/` (decisions and why).

Design: [Figma, Colour Shift](https://www.figma.com/design/IFKpGTC3reLa2GWP6go6KH/Colour-Shift?node-id=0-1). Source of truth for desktop visuals; wins over the style guide where they differ. Mockup contrast values are illustrative only. Mobile not designed yet.

Reference project: `../color-shift` (by MDS). Use it for reference only; don't copy code from it.

## Communication

When reporting information to me, be extremely concise and sacrifice grammar for the sake of concision. Exception: the teaching parts below are written in plain, full sentences.

## Teaching

This is my first project run like this; I'm learning as we go.

- **Plans** include a "What's going on" section: 2–4 plain-language points on why the step is shaped this way.
- **After each step**, add a "Worth knowing" note: the 1–2 ideas from the step that will come up again.
- **Checkpoints for me:**
  - Have me run the key commands myself (`! pnpm dev` etc.) instead of running them silently.
  - Tell me what to look for when I check in the browser.
  - Point me to one small file to read and explain it.
- **Going deeper:** if a topic is worth more than a quick note, offer to send it to my learning space with the `learn` skill rather than derailing the build.
- Don't explain things I've clearly already got. Keep each note short.

## How we work

- Plan before code. Present a plan for each build step and wait for my approval before writing code.
- Build one step at a time, following the build order in `SPEC.md`. Check each step in the browser before moving on.
- Make small commits with clear messages (`feat:`, `fix:`, `style:`, `docs:`).
- Keep this file current. Update it when a decision is made or the structure changes.
- End of each step or session: add an entry to the top of `docs/LOG.md` (done, decided, loose ends, next) in the same commit as the work.
- New term, or a term used inconsistently → update `CONTEXT.md` straight away. Hard-to-reverse, surprising trade-off → new ADR in `docs/adr/`.

## Stack

Next.js 16, React 19, TypeScript, Tailwind v4 (config lives in `globals.css`), pnpm, culori, apca-w3, node-vibrant, opentype.js. No GSAP; use CSS transitions only.

> **Next.js 16 has breaking changes.** APIs differ from training data. Before writing Next-specific code, read the relevant guide in `node_modules/next/dist/docs/`.

## Environment

- `UNSPLASH_ACCESS_KEY` in `.env.local` (never commit it or print its value)
- Deploys to Vercel at the site root (no basePath)
- Licensed fonts (Input Mono now; others at step 4) live in `public/fonts/`, which is gitignored. Local use only. The repo is public and the licences forbid redistribution. Always give a free fallback (JetBrains Mono for the UI). Before deploying: buy web licences and decide how the files reach Vercel.

## Architecture

Not built yet. Fill in as it takes shape.
