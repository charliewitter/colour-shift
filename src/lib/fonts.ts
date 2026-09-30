// Specimen fonts: the seven the sample text can be set in (CONTEXT.md: Specimen font).
// Free ones come from next/font/google (layout.tsx); licensed ones from @font-face in globals.css,
// local-only (docs/adr/0002), so each licensed font falls back to a free one of the same kind.

export const SPECIMEN_FONTS = [
  { id: "departure-mono", label: "Departure Mono", family: '"Departure Mono", var(--font-geist-mono), monospace' },
  { id: "input-mono", label: "Input Mono", family: '"Input Mono", var(--font-geist-mono), monospace' },
  { id: "geist", label: "Geist", family: "var(--font-geist-sans), sans-serif" },
  { id: "geist-mono", label: "Geist Mono", family: "var(--font-geist-mono), monospace" },
  { id: "instrument-serif", label: "Instrument Serif", family: "var(--font-instrument-serif), serif" },
  { id: "alpha-lyrae", label: "Alpha Lyrae", family: '"Alpha Lyrae", var(--font-geist-sans), sans-serif' },
  { id: "ghost-byte", label: "Ghost Byte", family: '"Ghost Byte", var(--font-geist-mono), monospace' },
] as const;

export type SpecimenFont = (typeof SPECIMEN_FONTS)[number];
export type SpecimenFontId = SpecimenFont["id"];

export const DEFAULT_FONT: SpecimenFontId = "departure-mono";

export function specimenFont(id: SpecimenFontId): SpecimenFont {
  return SPECIMEN_FONTS.find((font) => font.id === id) ?? SPECIMEN_FONTS[0];
}
