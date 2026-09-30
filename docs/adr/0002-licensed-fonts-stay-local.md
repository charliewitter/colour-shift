# Licensed fonts are local-only and never committed

Input Mono (and likely Departure Mono, Alpha Lyrae and Ghost Byte) is free only for personal use; web use needs a paid licence, and redistribution is forbidden. The repo is public, so the font files live in the gitignored `public/fonts/`, and every licensed font has a free fallback (Geist Mono for the UI). A fresh clone will render with fallbacks until the files are added by hand. Before deploying: buy web licences and decide how the files reach Vercel without entering the public repo.

Update 2026-09-30 (step 4): Departure Mono, Alpha Lyrae and Ghost Byte are now in use, loaded the same way with Geist/Geist Mono fallbacks. Their licences aren't checked yet (Departure Mono may be SIL OFL, which would allow committing it); check before deploying.
