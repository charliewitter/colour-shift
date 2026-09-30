// The only server code: talks to Unsplash so UNSPLASH_ACCESS_KEY never reaches the browser.
//   GET /api/photos?count=N     random photos, one per search word
//   GET /api/photos?id=<id>     one photo (share links, step 5)
//   GET /api/photos?download=<id>  Unsplash download tracking, required when a photo is used
import type { Photo } from "@/types/photo";

// Plain /photos/random returns a narrow curated set, so each photo is drawn from a different word.
const SEARCH_WORDS = [
  "nature", "architecture", "abstract", "texture", "city", "landscape", "portrait", "street",
  "minimal", "ocean", "mountain", "forest", "desert", "sky", "neon", "vintage", "food", "macro",
  "wildlife", "interior", "fashion", "art", "industrial", "graffiti", "flower", "space", "night",
  "rain", "fog", "sunset", "snow", "autumn", "reflection", "shadow", "pattern", "travel", "fruit",
  "market", "bird", "ceramics",
];

const MAX_COUNT = 10;
const UTM = "utm_source=colour_shift&utm_medium=referral";

// Only the fields we read from Unsplash's photo object.
type UnsplashPhoto = {
  id: string;
  alt_description: string | null;
  urls: { raw: string };
  links: { html: string };
  user: { name: string; links: { html: string } };
};

function withUtm(url: string): string {
  return `${url}${url.includes("?") ? "&" : "?"}${UTM}`;
}

function toPhoto(photo: UnsplashPhoto): Photo {
  return {
    id: photo.id,
    rawUrl: photo.urls.raw,
    alt: photo.alt_description ?? "Unsplash photo",
    photographer: photo.user.name,
    photographerUrl: withUtm(photo.user.links.html),
    photoUrl: withUtm(photo.links.html),
  };
}

/** Fetches from the Unsplash API; null on any failure so one bad photo doesn't sink a batch. */
async function unsplash<T>(path: string, key: string): Promise<T | null> {
  try {
    const res = await fetch(`https://api.unsplash.com${path}`, {
      headers: { Authorization: `Client-ID ${key}`, "Accept-Version": "v1" },
      cache: "no-store",
    });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

function shuffled<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export async function GET(request: Request) {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return Response.json({ error: "UNSPLASH_ACCESS_KEY is not set" }, { status: 500 });

  const params = new URL(request.url).searchParams;
  const id = params.get("id");
  const download = params.get("download");

  if (download) {
    const tracked = await unsplash(`/photos/${encodeURIComponent(download)}/download`, key);
    return Response.json({ ok: tracked !== null }, { status: tracked ? 200 : 502 });
  }

  if (id) {
    const photo = await unsplash<UnsplashPhoto>(`/photos/${encodeURIComponent(id)}`, key);
    return photo ? Response.json(toPhoto(photo)) : Response.json({ error: "Photo not found" }, { status: 404 });
  }

  const count = Math.min(Math.max(Number(params.get("count")) || 1, 1), MAX_COUNT);
  const words = shuffled(SEARCH_WORDS).slice(0, count);
  const results = await Promise.all(
    words.map((word) =>
      unsplash<UnsplashPhoto>(`/photos/random?query=${encodeURIComponent(word)}`, key),
    ),
  );
  const photos = results.filter((photo): photo is UnsplashPhoto => photo !== null).map(toPhoto);
  return photos.length
    ? Response.json(photos)
    : Response.json({ error: "Unsplash returned no photos" }, { status: 502 });
}
