// Share links (CONTEXT.md: Share link): /?photo=<id>&fg=<hex>&bg=<hex>&algo=apca&font=<id>&text=<text>
// Hex without "#". Values still at their default are left out, so links stay short.
import { toHex, type ContrastMethod, type Pair } from "@/lib/color-engine";
import { DEFAULT_FONT, type SpecimenFontId } from "@/lib/fonts";

export const DEFAULT_METHOD: ContrastMethod = "wcag";
export const DEFAULT_TEXT = "Aa";

export type Shared = {
  photoId: string | null;
  colors: Pair;
  method: ContrastMethod;
  font: SpecimenFontId;
  text: string;
};

/** The query string (no "?") that reopens this state. */
export function shareQuery({ photoId, colors, method, font, text }: Shared): string {
  const params = new URLSearchParams();
  if (photoId) params.set("photo", photoId);
  params.set("fg", toHex(colors.text).slice(1));
  params.set("bg", toHex(colors.bg).slice(1));
  if (method !== DEFAULT_METHOD) params.set("algo", method);
  if (font !== DEFAULT_FONT) params.set("font", font);
  if (text !== DEFAULT_TEXT) params.set("text", text);
  return params.toString();
}
