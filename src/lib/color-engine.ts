// All colour math lives here (APP-SPEC constraint). Components ask; this file answers.
import { clampChroma, converter, displayable, formatHex, parse, rgb, wcagContrast, type Color } from "culori";
import { APCAcontrast, sRGBtoY } from "apca-w3";

export type { Color };

/** Which colour of the pair (CONTEXT.md: Text colour, Background colour). */
export type Role = "text" | "bg";
export type Pair = Record<Role, Color>;

// ── Colours ───────────────────────────────────────────────────────────
// A colour is kept in the mode it was last edited in, at full precision.
// Hex is only derived for display, so a grey keeps its hue and dragging
// doesn't round to whole 0–255 steps.

export function fromHex(hex: string): Color {
  const color = parse(hex);
  if (!color) throw new Error(`Not a colour: ${hex}`);
  return color;
}

/** `#rrggbb`. OKLCH colours are pulled into sRGB gamut by chroma first. */
export function toHex(color: Color): string {
  return formatHex(color.mode === "oklch" ? clampChroma(color, "oklch") : color);
}

// ── Colour modes and channels ─────────────────────────────────────────

export type ColorMode = "oklch" | "hsb" | "rgb";

export type Channel = {
  key: string; // culori property
  label: string; // channel readout name
  scale: number; // slider units per culori unit
  max: number; // in slider units (OKLCH chroma's real max depends on gamut)
  step: number;
  decimals: number;
};

export const CHANNELS: Record<ColorMode, readonly Channel[]> = {
  hsb: [
    { key: "h", label: "HUE", scale: 1, max: 360, step: 0.1, decimals: 1 },
    { key: "s", label: "SATURATION", scale: 100, max: 100, step: 0.1, decimals: 1 },
    { key: "v", label: "BRIGHTNESS", scale: 100, max: 100, step: 0.1, decimals: 1 },
  ],
  oklch: [
    { key: "l", label: "LIGHTNESS", scale: 100, max: 100, step: 0.1, decimals: 1 },
    { key: "c", label: "CHROMA", scale: 1, max: 0.4, step: 0.001, decimals: 3 },
    { key: "h", label: "HUE", scale: 1, max: 360, step: 0.1, decimals: 1 },
  ],
  rgb: [
    { key: "r", label: "RED", scale: 255, max: 255, step: 1, decimals: 0 },
    { key: "g", label: "GREEN", scale: 255, max: 255, step: 1, decimals: 0 },
    { key: "b", label: "BLUE", scale: 255, max: 255, step: 1, decimals: 0 },
  ],
};

const CULORI_MODE = { oklch: "oklch", hsb: "hsv", rgb: "rgb" } as const;

// culori colours as plain records, so channels can be read and written by key.
type Channels = Record<string, number | undefined>;

function inMode(color: Color, mode: ColorMode): Channels {
  const target = CULORI_MODE[mode];
  if (color.mode === target) return { ...(color as unknown as Channels) };
  return { ...(converter(target)(color) as unknown as Channels) };
}

function build(mode: ColorMode, channels: Channels): Color {
  return { ...channels, mode: CULORI_MODE[mode] } as unknown as Color;
}

/** Channel value in slider units. An undefined hue (greys) reads as 0. */
export function getChannel(color: Color, mode: ColorMode, channel: Channel): number {
  return (inMode(color, mode)[channel.key] ?? 0) * channel.scale;
}

/** New colour, now stored in `mode`. OKLCH chroma is capped to the gamut edge. */
export function setChannel(color: Color, mode: ColorMode, channel: Channel, value: number): Color {
  const channels = inMode(color, mode);
  channels[channel.key] = value / channel.scale;
  if ("h" in channels) channels.h ??= 0;
  if (mode === "oklch") {
    channels.c = Math.min(channels.c ?? 0, maxChroma(channels.l ?? 0, channels.h ?? 0));
  }
  return build(mode, channels);
}

/** Slider maximum. For OKLCH chroma it's the most sRGB can show at this lightness and hue. */
export function channelMax(color: Color, mode: ColorMode, channel: Channel): number {
  if (mode !== "oklch" || channel.key !== "c") return channel.max;
  const { l = 0, h = 0 } = inMode(color, "oklch");
  return maxChroma(l, h);
}

/** CSS gradient for a slider track: this channel swept end to end, others held. */
export function channelGradient(color: Color, mode: ColorMode, channel: Channel): string {
  const max = channelMax(color, mode, channel);
  const stops = Array.from({ length: 13 }, (_, i) => {
    const swept = setChannel(color, mode, channel, (max * i) / 12);
    return toHex(swept);
  });
  return `linear-gradient(to right, ${stops.join(", ")})`;
}

export function formatChannel(value: number, channel: Channel): string {
  return value.toFixed(channel.decimals);
}

// Binary search for the largest chroma sRGB can display at this lightness and hue.
function maxChroma(l: number, h: number): number {
  let low = 0;
  let high = 0.4;
  for (let i = 0; i < 20; i++) {
    const mid = (low + high) / 2;
    if (displayable({ mode: "oklch", l, c: mid, h })) low = mid;
    else high = mid;
  }
  return low;
}

// ── Contrast ──────────────────────────────────────────────────────────

export type ContrastMethod = "wcag" | "apca";

// Where each grade begins, lowest first (CONTEXT.md: Level). GRADES lines up index for index.
export const LEVELS: Record<ContrastMethod, readonly number[]> = {
  wcag: [1.5, 3, 4.5, 7],
  apca: [30, 45, 60, 75, 90],
};

const GRADES: Record<ContrastMethod, readonly string[]> = {
  wcag: ["Incidental", "AA Large", "AA", "AAA"],
  apca: ["Spot", "Headline", "Content", "Body", "Preferred Body"],
};

/** WCAG: ratio 1–21 (order doesn't matter). APCA: signed Lc (order matters). */
export function getContrast(text: Color, bg: Color, method: ContrastMethod): number {
  // Score what's on screen: the hex, after any gamut clamping.
  const textHex = toHex(text);
  const bgHex = toHex(bg);
  if (method === "wcag") return wcagContrast(textHex, bgHex);
  return APCAcontrast(sRGBtoY(toRgb255(textHex)), sRGBtoY(toRgb255(bgHex)));
}

const BLACK = fromHex("#000000");
const WHITE = fromHex("#ffffff");

/** Black or white, whichever reads better on `bg` (larger APCA Lc). For labels on a user's colour. */
export function readableOn(bg: Color): "#000000" | "#ffffff" {
  const onBlack = Math.abs(getContrast(BLACK, bg, "apca"));
  const onWhite = Math.abs(getContrast(WHITE, bg, "apca"));
  return onBlack >= onWhite ? "#000000" : "#ffffff";
}

/** Highest grade the value reaches, or "Fail". APCA grades ignore the sign. */
export function getGrade(value: number, method: ContrastMethod): string {
  const level = getPassingLevel(value, method);
  return level === null ? "Fail" : GRADES[method][LEVELS[method].indexOf(level)];
}

/** The highest level the value meets (CONTEXT.md: Passing level), or null. */
export function getPassingLevel(value: number, method: ContrastMethod): number | null {
  const passed = LEVELS[method].filter((level) => Math.abs(value) >= level);
  return passed.length ? passed[passed.length - 1] : null;
}

export function formatLevel(level: number, method: ContrastMethod): string {
  return method === "wcag" ? level.toFixed(1) : String(level);
}

/**
 * Moves one colour's OKLCH lightness until the pair just reaches `target`,
 * keeping hue (chroma is capped to gamut on the way). Contrast dips to ~1 where
 * both colours match and rises towards black and white, so there can be a
 * crossing on each side: take the one nearest the current lightness. If the
 * target is out of reach, go to whichever end gives the most contrast.
 */
export function reachLevel(pair: Pair, role: Role, target: number, method: ContrastMethod): Color {
  const [lightness] = CHANNELS.oklch;
  const withLightness = (l: number) => setChannel(pair[role], "oklch", lightness, l * 100);
  const strength = (l: number) => {
    const moved = { ...pair, [role]: withLightness(l) };
    return Math.abs(getContrast(moved.text, moved.bg, method));
  };
  const passes = (l: number) => strength(l) >= target;

  const current = inMode(pair[role], "oklch").l ?? 0;
  const STEPS = 100;
  const samples = Array.from({ length: STEPS + 1 }, (_, i) => i / STEPS);

  // Each sign change between neighbouring samples hides a crossing; bisect to it,
  // always keeping the passing side so the result really meets the level.
  const crossings: number[] = [];
  for (let i = 0; i < STEPS; i++) {
    let a = samples[i];
    let b = samples[i + 1];
    if (passes(a) === passes(b)) continue;
    if (!passes(b)) [a, b] = [b, a]; // b passes, a doesn't
    for (let j = 0; j < 24; j++) {
      const mid = (a + b) / 2;
      if (passes(mid)) b = mid;
      else a = mid;
    }
    crossings.push(b);
  }

  if (crossings.length === 0) {
    // Nowhere passes (or everywhere does): best effort is the stronger end.
    return withLightness(strength(0) >= strength(1) ? 0 : 1);
  }
  const nearest = crossings.reduce((best, l) => (Math.abs(l - current) < Math.abs(best - current) ? l : best));
  return withLightness(nearest);
}

/** Score text for the dock: `AA 5.21:1` or `Content Lc -64.3`. */
export function formatScore(text: Color, bg: Color, method: ContrastMethod): string {
  const value = getContrast(text, bg, method);
  const grade = getGrade(value, method);
  // Truncate, never round up: 4.499 must not display as a passing 4.50.
  return method === "wcag"
    ? `${grade} ${truncate(value, 2).toFixed(2)}:1`
    : `${grade} Lc ${truncate(value, 1).toFixed(1)}`;
}

// ── Export ────────────────────────────────────────────────────────────

const METHOD_NAMES: Record<ContrastMethod, string> = { wcag: "WCAG 2", apca: "APCA" };

/** The pair as a Markdown file (CONTEXT.md: Export): both colours, the score, the share link, the credit. */
export function exportMarkdown({
  colors,
  method,
  shareUrl,
  credit,
}: {
  colors: Pair;
  method: ContrastMethod;
  shareUrl: string;
  credit: { photographer: string; photographerUrl: string; photoUrl: string } | null;
}): string {
  const row = (name: string, color: Color) => {
    // From the hex, so every value describes the colour on screen (after gamut clamping).
    const hex = toHex(color);
    const [r, g, b] = toRgb255(hex);
    const { l = 0, c = 0, h = 0 } = inMode(fromHex(hex), "oklch");
    const oklch = `oklch(${(l * 100).toFixed(1)}% ${c.toFixed(3)} ${h.toFixed(1)})`;
    return `| ${name} | \`${hex.toUpperCase()}\` | \`rgb(${r} ${g} ${b})\` | \`${oklch}\` |`;
  };
  return [
    "# Colour Shift pair",
    "",
    "| | Hex | RGB | OKLCH |",
    "| --- | --- | --- | --- |",
    row("Text", colors.text),
    row("Background", colors.bg),
    "",
    `**Contrast (${METHOD_NAMES[method]}):** ${formatScore(colors.text, colors.bg, method)}`,
    "",
    `**Share link:** ${shareUrl}`,
    ...(credit
      ? ["", `Photo by [${credit.photographer}](${credit.photographerUrl}) on [Unsplash](${credit.photoUrl})`]
      : []),
    "",
  ].join("\n");
}

// ── Pairing from a photo ──────────────────────────────────────────────

/** A colour found in a photo (CONTEXT.md: Photo colour), with how many pixels it covers. */
export type PhotoColor = { hex: string; population: number };

// How much vivid colour counts against raw contrast. OKLCH chroma runs 0–~0.37, log contrast 0–~3,
// so two strong colours (chroma 0.2 each) are worth about as much as doubling the contrast ratio.
const VIVID_WEIGHT = 2;
// Below this a pair barely reads at all (WCAG's Incidental level); only used if nothing better exists.
const MIN_PAIR_CONTRAST = 1.5;

/**
 * The most dramatic pair from a photo's colours (APP-SPEC: prefer vivid over muted averages):
 * every pairing is scored on contrast plus the colourfulness of both colours. The darker colour
 * becomes the background. A single colour is paired with black or white; none gives null.
 */
export function pickPair(photoColors: readonly PhotoColor[]): Pair | null {
  const colors = photoColors.filter((c) => c.population > 0).map((c) => fromHex(c.hex));
  if (colors.length === 0) return null;
  if (colors.length === 1) {
    const [black, white] = [fromHex("#000000"), fromHex("#ffffff")];
    colors.push(wcagContrast(colors[0], white) > wcagContrast(colors[0], black) ? white : black);
  }

  const pairs = colors.flatMap((a, i) => colors.slice(i + 1).map((b) => [a, b] as const));
  const scored = pairs.map(([a, b]) => {
    const ratio = wcagContrast(a, b);
    return { a, b, ratio, score: Math.log(ratio) + VIVID_WEIGHT * (chroma(a) + chroma(b)) };
  });
  const readable = scored.filter((p) => p.ratio >= MIN_PAIR_CONTRAST);
  const best = (readable.length ? readable : scored).reduce((top, p) => (p.score > top.score ? p : top));

  return lightness(best.a) < lightness(best.b) ? { bg: best.a, text: best.b } : { bg: best.b, text: best.a };
}

function lightness(color: Color): number {
  return inMode(color, "oklch").l ?? 0;
}

function chroma(color: Color): number {
  return inMode(color, "oklch").c ?? 0;
}

function truncate(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.trunc(value * factor) / factor;
}

function toRgb255(hex: string): [number, number, number] {
  const c = rgb(hex);
  if (!c) throw new Error(`Not a colour: ${hex}`);
  const to255 = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255);
  return [to255(c.r), to255(c.g), to255(c.b)];
}
