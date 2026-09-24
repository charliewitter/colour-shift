# Colour Shift

One-page web app for finding new colour pairings from random Unsplash photos, with contrast scoring and slider fine-tuning. Full spec: `SPEC.md` (what to build). Build rules + behaviour: `APP-SPEC.md`. Look + motion: `COLOUR-SHIFT-STYLE-GUIDE.md`. Read all three before planning any work.

Reference project: `../color-shift` (by MDS). Use it for reference only; don't copy code from it.

## Communication

When reporting information to me, be extremely concise and sacrifice grammar for the sake of concision.

## How we work

- Plan before code. Present a plan for each build step and wait for my approval before writing code.
- Build one step at a time, following the build order in `SPEC.md`. Check each step in the browser before moving on.
- Make small commits with clear messages (`feat:`, `fix:`, `style:`, `docs:`).
- Keep this file current. Update it when a decision is made or the structure changes.

## Stack

Next.js 16, React 19, TypeScript, Tailwind v4 (config lives in `globals.css`), pnpm, culori, apca-w3, node-vibrant, opentype.js. No GSAP; use CSS transitions only.

> **Next.js 16 has breaking changes.** APIs differ from training data. Before writing Next-specific code, read the relevant guide in `node_modules/next/dist/docs/`.

## Environment

- `UNSPLASH_ACCESS_KEY` in `.env.local` (never commit it or print its value)
- Deploys to Vercel at the site root (no basePath)

## Architecture

Not built yet. Fill in as it takes shape.
