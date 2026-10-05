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

CSS only: transitions, `@starting-style` and keyframes (no GSAP). Motion is quick and small, and it never gets in the way of a value you're changing.

**Rules**

- **Live input is instant.** Anything driven by a drag or fast changes (slider colours, rolling values) shows each change straight away. Animation is for single, discrete changes.
- **Open softly, close instantly** for menus and inline options (font menu, desktop levels, export options). Panels that change the layout (slider panel, mobile levels) animate both ways, so nothing jumps.
- **Small distances:** 4px for drops and panel slides, 8px for levels, 16px for the export pop. Only the photo moves a full width.
- **Colours trail the photo** a little, so the photo leads and the pair follows.

**Timing**

| Use | Duration | Easing |
| --- | --- | --- |
| Default (hover, press, fades, panels) | 200ms | `cubic-bezier(0.33, 1, 0.68, 1)` (ease-out) |
| Photo slide (desktop) / crossfade (mobile) | 600ms | ease-out |
| Colour fade, from a photo | 100ms delay + 700ms | ease-out |
| Colour fade, single action (swap, level) | 200ms | ease-out |
| Colour fade, slider drag | instant | — |
| Rolling value | 300ms, 12ms stagger per character | ease-out |
| Export options pop | 400ms | `cubic-bezier(0.34, 1.56, 0.64, 1)` (slight overshoot) |
| Full photo over its blurred preview | 400ms | ease-out |
| Channel readout fade-out | 200ms, after 1s | ease-out |

The shipping values come from DialKit tuning; its panels hold the same numbers as defaults.

**Pieces**

- **Photo change:** desktop slides the photo in from the side you're moving towards (→ from the right, ← from the left). Mobile crossfades instead (vertical motion only on mobile). The blurred 200px preview sits under the full photo until it loads. The first photo has no slide and no preview: it fades in over 0.2s, and the colours fade in from an empty dark panel.
- **Colour fades:** the colour panel, swatches and mobile swatch blocks all fade with the timing above. The fade depends on what changed the colour, not on where it shows.
- **Panels** (slider panel, mobile levels): row height `0fr ↔ 1fr`, a fade and a 4px vertical slide, both ways. The slider panel keeps showing the last colour while it closes.
- **Font menu:** fades in with a 4px drop; closes instantly.
- **Desktop levels:** fade in sliding 8px from the left (they open sideways from the score); close instantly.
- **Export:** the toggle stays put and its label rolls EXPORT ⇄ CLOSE. COPY URL and DOWNLOAD .MD pop out to its left together (16px slide, slight overshoot); close instantly.
- **Rolling values** (score, hex, EXPORT ⇄ CLOSE): the old value rolls up and out while the new one rolls up from below, character by character left to right (55% of the line, 0.5px blur). Changes less than 300ms apart (a drag) show instantly. The box takes the new value's width as soon as the roll starts.
- **Buttons:** 200ms fill change on hover; pressed scales to 0.95 and pops back.
- **Slider grip:** grows from 8px to 24px (glass look) on hover and while dragged.
- **Channel readout:** shows on slider hover, focus or drag; fades out 1s after release or leaving.
- **Sample text:** dims to 65% on hover (reads as editable), full while editing.
- **Mobile swatch row:** column widths animate when the active colour changes (a resize, not a slide).

**Reduced motion:** with `prefers-reduced-motion`, transitions are 0 and animations 1ms, so everything snaps. (1ms, not none: code waiting for an animation to end, like the leaving photo, still hears it end.)

## Details

- UI text isn't selectable, except the sample text while editing it.
- Selected sample text is tinted with the fg colour at 20%.
- On mobile Safari, the address bar tint follows the background colour.
- Every control has a visible keyboard focus state.
