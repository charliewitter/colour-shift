# Colour Shift: Spec

Approved 2026-09-24. Reference project: `../color-shift` (by MDS). Use it for reference only; don't copy code from it.

## What it is

A one-page web app for **finding new colour pairings**. It shows a stream of random Unsplash photos, takes a background and text colour from each one, and shows the pair as editable sample text with a contrast score. It's a tool for my own design inspiration, and building it is also how I'm learning the Claude workflow.

## What it does

1. **Photo stream.** It loads random Unsplash photos across a wide spread of subjects, using a rotating list of search terms like MDS's. You move between photos with on-screen arrows (on the photo and in the dock) and the keyboard arrow keys, and the space bar jumps to a new random photo. Each photo shows the photographer's credit, which Unsplash's rules require.
2. **Automatic pairing.** Each photo's palette is analysed in the browser, and a strong background colour and text colour are picked from it.
3. **Colour panel.** The pair appears next to the photo, with sample text you can type into. You can choose from the same seven fonts MDS uses (Geist, Geist Mono, Instrument Serif, Alpha Lyrae, Departure Mono, Ghost Byte, Input Mono). I'll handle their licences myself.
4. **Contrast score.** The score is always visible, with a switch between **WCAG** and **APCA**, and it shows whether the pair passes. Clicking it shows every threshold level; clicking a level moves the colour to reach it.
5. **Fine-tuning.** Full sliders for either colour, with **OKLCH / HSB / RGB** modes. A swap button flips text and background. The sliders only show once you pick the text or background colour to edit.
6. **Keeping a pair:**
   - **Copy a share link** that reopens the same photo, colours, contrast method and sample text.
   - **Download a Markdown file** with the colours, score, share link and photo credit.

## Look and feel

- **It matches MDS's visual design**: his dark interface, the colour panel next to the photo, and the dock (control bar) along the bottom.
- **Desktop and mobile both get proper layouts**, arranged the way his are.
- **Motion stays simple.** Smooth CSS transitions everywhere and no GSAP, which avoids the fragile part of his build.

## Not included (for now)

- Embed mode, the locked display/showcase mode, and social preview images
- Uploading my own photos, searching Unsplash by theme, and generated palettes
- Saved collections or history
- Extra features of my own; those can come after the core works

## Technical basics

- **Same stack as MDS:** Next.js 16, React 19, TypeScript, Tailwind v4, pnpm, culori, apca-w3, node-vibrant, opentype.js
- **Hosting:** Vercel, at the root of my own URL, with none of his `/color-shift` base path
- **Unsplash key** kept in `.env.local` locally (`UNSPLASH_ACCESS_KEY`) and set as an environment variable in Vercel
- None of the Shift Nudge wiring: no Shift Nudge tracking tags on Unsplash links, no embed messaging, no Shift Nudge favicon

## How we'll build it

- **From scratch** in this folder, with MDS's repo used only as a reference.
- **Step by step:** plan each piece, build it, and check it in the browser before moving on. I approve each plan before any code is written.
- **A `CLAUDE.md` from day one** that we keep up to date, plus small commits with clear messages.
- **Build order:**
  1. Two colours and a contrast score
  2. Sliders and colour modes
  3. Unsplash photos and palette extraction
  4. Sample text and fonts
  5. Copy, share link and export
  6. Mobile layout
  7. Motion polish
  8. Deploy to Vercel

## Open points

1. Should the name and interface text use British spelling ("Colour Shift")?
