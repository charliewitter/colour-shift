# First Prompt

Paste into a fresh Claude Code session in this folder to start the build.

---

Read `CLAUDE.md`, `SPEC.md`, `APP-SPEC.md` and `COLOUR-SHIFT-STYLE-GUIDE.md`.

We're doing **build step 0: project setup** only. Plan it and wait for my approval before running anything.

The plan should cover:
- Creating a Next.js 16 app in this folder with pnpm, TypeScript, App Router, Tailwind v4 and ESLint. Don't overwrite `CLAUDE.md`, the 3 spec files, `.gitignore` or `.env.local`.
- Reading the relevant guides in `node_modules/next/dist/docs/` after install, and flagging anything that changes the plan.
- Setting up the colour tokens and base styles from the style guide in `globals.css`.
- One page: dark canvas, a 50/50 placeholder colour panel and photo panel, and an empty control bar pinned to the bottom. Desktop layout only. No features, no colour logic.
- Page title "Colour Shift".
- Cleaning out the starter template's leftover files and assets.
- Checking that `pnpm dev`, `pnpm lint` and `pnpm build` all pass.
- Filling in the Architecture section of `CLAUDE.md`.
- One commit at the end.

In your plan, list anything in the specs that's unclear, contradictory or wrong for step 0. Don't start step 1.
