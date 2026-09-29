// apca-w3 ships no types. Only the two functions we use are declared.
declare module "apca-w3" {
  /** Signed Lc: positive = dark text on light, negative = light text on dark. Order matters. */
  export function APCAcontrast(textY: number, bgY: number): number;
  /** Screen luminance (Y) from 0–255 sRGB channels. */
  export function sRGBtoY(rgb: [number, number, number]): number;
}
