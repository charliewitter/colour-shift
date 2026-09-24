# Colour Shift: Style Guide

How Colour Shift looks and moves. Companion to `SPEC.md` (what) and `APP-SPEC.md` (how it works).

Values were taken from MDS's reference repo (`../color-shift`) on 2026-09-24. Check against it when in doubt, but don't copy code.

## Principle

The chrome stays dark and quiet. The chosen colour pair and the photo are the only colour on screen.

## Colour tokens

Defined once as CSS variables in `globals.css`. Components use the tokens, never raw hex.

| Token | Hex | Use |
|---|---|---|
| `--cs-canvas` | `#0f0e0f` | Page background, dock, photo arrows |
| `--cs-surface` | `#1a1718` | Panels |
| `--cs-surface-raised` | `#212121` | Hover and selected button fill |
| `--cs-stroke` | `#303030` | Selected button inset outline (1px) |
| `--cs-border` | `#1b191a` | Dividers |
| `--cs-text-muted` | `#a39f9f` | Default button and label text |
| `--cs-text-strong` | `#e5e0e0` | Selected / active text |

## Typography

- **UI font:** Input Mono, 12px (`text-xs`), `leading-none`. 14px on mobile.
- **Labels are UPPERCASE:** `FG`, `BG`, `EXPORT`, `COPY URL`, `DOWNLOAD .MD`, `CLOSE`, `OKLCH`.
- **Numbers** use tabular figures so scores don't jiggle.
- **Sample text:** the chosen specimen font, `leading-[1.05]`, `tracking-tight`, centred.
- **Specimen fonts:** Geist, Geist Mono, Instrument Serif, Alpha Lyrae, Departure Mono, Ghost Byte, Input Mono. Default: Departure Mono.

## Shape and spacing

- **Button:** `p-2`, `rounded-[4px]`, label plus optional swatch with `gap-2`.
- **Swatch:** 12×12px, `rounded-[2px]`, 1px inner border (white 10% on dark colours, black 10% on light).
- **Photo arrows:** 40×40px, `rounded-[4px]`, canvas background, 20px icon.
- **Dock:** 16px padding (`p-4`). Gaps between controls 4–16px (`gap-1` to `gap-4`).
- **Slider:** track 6–8px tall and rounded, custom 24px grip.
- **Radius:** 4px everywhere, except swatches (2px) and fully round items.

## Button states

| State | Look |
|---|---|
| Default | Transparent, muted text |
| Hover | `surface-raised` fill |
| Selected | `surface-raised` fill + 1px inset `stroke` outline + strong text |
| Pressed | Scales to 0.95, pops back |
| Focus (keyboard) | 1px ring, white 30% |

## Motion

CSS transitions only.

- **Default timing:** `0.2s cubic-bezier(0.33, 1, 0.68, 1)`
- **Colour crossfade:** ~0.4s. **Photo slide:** ~0.6s.
- **Panels open** with `grid-template-rows: 0fr → 1fr`, a fade, and a small vertical slide.
- **Mobile:** vertical motion only.
- **Reduced motion:** respect `prefers-reduced-motion` and turn transitions off.

## Details

- UI text isn't selectable, except the sample text while editing it.
- Selected sample text is tinted with the fg colour at 20%.
- On mobile Safari, the address bar tint follows the background colour.
- Every control has a visible keyboard focus state.
