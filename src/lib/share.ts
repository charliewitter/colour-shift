// Share links (CONTEXT.md: Share link): /?photo=<id>&fg=<hex>&bg=<hex>&algo=apca&font=<id>&text=<text>
// Hex without "#". Values still at their default are left out, so links stay short.
import { toHex, type ContrastMethod, type Pair } from "@/lib/color-engine";
import { DEFAULT_FONT, SPECIMEN_FONTS, type SpecimenFontId } from "@/lib/fonts";

export const DEFAULT_METHOD: ContrastMethod = "wcag";
export const DEFAULT_TEXT = "Aa";
/** Longest sample text (a specimen, not a document; keeps links short). */
export const MAX_TEXT_LENGTH = 100;

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

/** What a share link asked for, checked field by field; anything missing or invalid is null. */
export type SharedParams = {
  photoId: string | null;
  /** Both hex (with "#"), or null unless both are valid. */
  colors: { text: string; bg: string } | null;
  method: ContrastMethod | null;
  font: SpecimenFontId | null;
  text: string | null;
};

type SearchParams = Record<string, string | string[] | undefined>;

const HEX = /^[0-9a-f]{6}$/i;
const PHOTO_ID = /^[\w-]{1,64}$/;

export function parseShare(params: SearchParams): SharedParams {
  const get = (key: string) => {
    const value = params[key];
    return typeof value === "string" ? value : null;
  };
  const photo = get("photo");
  const fg = get("fg");
  const bg = get("bg");
  const algo = get("algo");
  const font = get("font");
  const text = get("text");
  return {
    photoId: photo && PHOTO_ID.test(photo) ? photo : null,
    colors: fg && bg && HEX.test(fg) && HEX.test(bg) ? { text: `#${fg}`, bg: `#${bg}` } : null,
    method: algo === "wcag" || algo === "apca" ? algo : null,
    font: SPECIMEN_FONTS.some((option) => option.id === font) ? (font as SpecimenFontId) : null,
    text: text === null ? null : text.slice(0, MAX_TEXT_LENGTH),
  };
}

export const NOTHING_SHARED: SharedParams = { photoId: null, colors: null, method: null, font: null, text: null };
