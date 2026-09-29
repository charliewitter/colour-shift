// All colour math lives here (APP-SPEC constraint). Components ask; this file answers.
import { rgb, wcagContrast } from "culori";
import { APCAcontrast, sRGBtoY } from "apca-w3";

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
export function getContrast(text: string, bg: string, method: ContrastMethod): number {
  if (method === "wcag") return wcagContrast(text, bg);
  return APCAcontrast(sRGBtoY(toRgb255(text)), sRGBtoY(toRgb255(bg)));
}

/** Highest grade the value reaches, or "Fail". APCA grades ignore the sign. */
export function getGrade(value: number, method: ContrastMethod): string {
  const size = Math.abs(value);
  let grade = "Fail";
  LEVELS[method].forEach((level, i) => {
    if (size >= level) grade = GRADES[method][i];
  });
  return grade;
}

/** Score text for the dock: `AA 5.21:1` or `Content Lc -64.3`. */
export function formatScore(text: string, bg: string, method: ContrastMethod): string {
  const value = getContrast(text, bg, method);
  const grade = getGrade(value, method);
  // Truncate, never round up: 4.499 must not display as a passing 4.50.
  return method === "wcag"
    ? `${grade} ${truncate(value, 2).toFixed(2)}:1`
    : `${grade} Lc ${truncate(value, 1).toFixed(1)}`;
}

function truncate(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.trunc(value * factor) / factor;
}

function toRgb255(color: string): [number, number, number] {
  const c = rgb(color);
  if (!c) throw new Error(`Not a colour: ${color}`);
  const to255 = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255);
  return [to255(c.r), to255(c.g), to255(c.b)];
}
