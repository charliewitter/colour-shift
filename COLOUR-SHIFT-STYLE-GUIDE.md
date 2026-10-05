# Colour Shift: Style Guide

How Colour Shift looks and moves. Companion to `SPEC.md` (what) and `APP-SPEC.md` (how it works).

Values were taken from MDS's reference repo (`../color-shift`) on 2026-09-24. The Figma file ([Colour Shift](https://www.figma.com/design/IFKpGTC3reLa2GWP6go6KH/Colour-Shift?node-id=0-1)) is the source of truth for desktop visuals; where it differs from this guide, Figma wins. Its mockup contrast values are illustrative only.

## Principle

The chrome stays dark and quiet. The chosen colour pair and the photo are the only colour on screen.

## Colour tokens

Defined once as CSS variables in `globals.css`. Components use the tokens, never raw hex.

| Token | Hex | Use |
|---|---|---|
| `--cs-canvas` | `#0f0e0f` | Page background, dock, photo arrows |
| `--cs-surface` | `#1a1718` | Panels |
| `--cs-surface-raised` | `#262626` | Hover and selected button fill |
| `--cs-stroke` | `#3e3e3e` at 80% | Selected / pressed button outline (1px, inside) |
| `--cs-well` | `#000000` | Recessed groups: contrast method switch, level buttons |
| `--cs-border` | `#1b191a` | Dividers |
| `--cs-text-muted` | `#a39f9f` | Default button and label text |
| `--cs-text-strong` | `#ffffff` | Selected / active text |
| `--cs-swatch-edge` | `#fafafa` at 30% | Swatch border (0.5px) |
| `--cs-focus` | `#ffffff` at 20% | Keyboard focus ring |

## Typography

- **UI font:** Input Mono, 12px (`text-xs`), `leading-none`. 14px on mobile.
- **Labels are UPPERCASE:** `EXPORT`, `COPY URL`, `DOWNLOAD .MD`, `CLOSE`, `OKLCH`, `HUE`. No labels on the colour pickers; the swatch + hex speaks for itself.
- **Score text keeps the case the contrast check returns** (`Content Lc 74.9`, `AA Large 4.45:1`). It's data, not a label.
- **Numbers** use tabular figures so scores don't jiggle.
- **Sample text:** the chosen specimen font, `leading-[1.05]`, `-0.02em` tracking (Figma), centred. 96px, shrinking to fit the colour panel (down to 16px) as it grows. Max 100 characters.
- **Specimen fonts:** Geist, Geist Mono, Instrument Serif, Alpha Lyrae, Departure Mono, Ghost Byte, Input Mono. Default: Departure Mono.

## Shape and spacing

- **Button:** `p-2`, `rounded-[4px]`, label plus optional swatch with `gap-2`.
- **Swatch:** 12×12px, `rounded-[2px]`, 0.5px `swatch-edge` border on every colour (Figma).
- **Photo arrows:** two sets doing the same thing. On the photo: 40×40px, `rounded-[4px]`, canvas background, 20px icon, shown on hover. In the dock: 16px ← → icons next to EXPORT.
- **Dock:** 56px tall, 16px side padding (`px-4`), controls centred vertically (28px buttons, 14px above and below). Gaps between controls 4–16px (`gap-1` to `gap-4`).
- **Slider:** 12px-tall row. 6px fully rounded track showing a live gradient of that channel, with a 1px inside stroke at white 15%.
- **Grip** (Figma `grip`, `expanded=false|true`): a 24×24px hit area centred on the track.
  - **Rest:** 8px white dot with a 1px white-10% inside stroke.
  - **Expanded** (on hover and while dragging): 24px circle, white 20% fill, 1px white-40% stroke, glass effect (Figma GLASS, radius 3). In CSS this is approximated with `backdrop-filter` blur, since Figma's refraction can't be matched exactly.
- **Slider panel:** canvas fill, 1px `border` divider, 16px padding all round. 16px gap between the mode row and the sliders, 20px gap between sliders. The mode row puts the tabs on the left and the channel readout on the right.
- **Radius:** 4px everywhere, except swatches (2px) and fully round items.

## Button states

| State | Look |
|---|---|
| Default | Transparent, muted text |
| Hover | `surface-raised` fill, muted text |
| Pressed (Figma `active`) | `surface-raised` fill + 1px inside `stroke` outline, muted text; scales to 0.95, pops back |
| Selected | `surface-raised` fill + 1px inside `stroke` outline + strong text |
| Segment selected (WCAG/APCA switch) | `surface-raised` fill + strong text, no outline, inside a `well` track |
| Focus (keyboard) | 1px ring, white 20% |

## Motion

CSS transitions only.

- **Default timing:** `0.2s cubic-bezier(0.33, 1, 0.68, 1)`
- **Colour crossfade:** 0.7s after a 0.1s delay, so the colours trail the photo slightly (softer; changed from ~0.4s on 2026-09-30). Only when colours come from a photo; hand edits are instant. **Photo slide:** 0.6s.
- **First photo:** no slide and no blurred preview; the photo fades in over 0.2s and the colours fade in from an empty dark panel.
- **Panels open and close** with `grid-template-rows: 0fr ↔ 1fr`, a fade, and a 4px vertical slide (slider panel, mobile levels). Desktop levels and export options fade in (levels slide 8px from the left) and close instantly, like the font menu.
- **Colour fades by kind of change:** photo 0.1s delay + 0.7s; single action (swap, level) 0.2s; slider drag instant.
- **Rolling values** (score, hex): per character, left to right. 300ms, 55% of the line, 0.5px blur, 12ms stagger. Changes less than 300ms apart show instantly.
- **Mobile:** vertical motion only. Photos crossfade (0.6s) instead of sliding. The swatch row's widths animate when the active colour changes (a resize, not a slide).
- **Reduced motion:** respect `prefers-reduced-motion` and turn transitions off.

## Details

- UI text isn't selectable, except the sample text while editing it.
- Selected sample text is tinted with the fg colour at 20%.
- On mobile Safari, the address bar tint follows the background colour.
- Every control has a visible keyboard focus state.
