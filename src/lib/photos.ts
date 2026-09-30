// Browser side of photos: asking /api/photos, sizing Unsplash URLs, and reading a photo's pair.
import { pickPair, type Pair, type PhotoColor } from "@/lib/color-engine";
import type { Photo } from "@/types/photo";

// Unsplash (imgix) resizes from URL parameters. Extraction reads a small copy: palettes barely
// change with size, and a 200px image decodes and quantises in a few milliseconds.
const DISPLAY_WIDTH = 1600;
const EXTRACT_WIDTH = 200;

export function photoSrc(photo: Photo, width = DISPLAY_WIDTH): string {
  const url = new URL(photo.rawUrl);
  url.searchParams.set("w", String(width));
  url.searchParams.set("q", "80");
  url.searchParams.set("auto", "format");
  url.searchParams.set("fit", "max");
  return url.toString();
}

/** The small copy extraction reads. Already cached by then, so it doubles as the blurred preview. */
export function previewSrc(photo: Photo): string {
  return photoSrc(photo, EXTRACT_WIDTH);
}

export async function fetchRandomPhotos(count: number): Promise<Photo[]> {
  const res = await fetch(`/api/photos?count=${count}`);
  if (!res.ok) throw new Error(`Couldn't load photos (${res.status})`);
  return res.json();
}

/** Starts downloading the display copy so it's already cached when the photo is shown. */
export function preloadPhoto(photo: Photo): void {
  new Image().src = photoSrc(photo);
}

/** Unsplash asks for this whenever a photo is used. Fire and forget: failure shouldn't bother the user. */
export function trackDownload(photo: Photo): void {
  fetch(`/api/photos?download=${encodeURIComponent(photo.id)}`).catch(() => {});
}

/** The photo's most dramatic pair, or null if its palette can't be read. */
export async function extractPair(photo: Photo): Promise<Pair | null> {
  // Loaded on first use: node-vibrant needs the DOM, and keeping it out of the first bundle helps load time.
  const { Vibrant } = await import("node-vibrant/browser");
  try {
    const palette = await Vibrant.from(previewSrc(photo)).getPalette();
    const photoColors: PhotoColor[] = Object.values(palette)
      .filter((swatch) => swatch !== null)
      .map((swatch) => ({ hex: swatch.hex, population: swatch.population }));
    return pickPair(photoColors);
  } catch {
    return null;
  }
}
