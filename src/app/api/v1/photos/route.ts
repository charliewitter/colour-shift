// /api/v1/photos: the versioned photo API for the iOS app (ios.md §7). The website keeps
// using /api/photos. Shipped app builds can't update with every deploy, so this contract is
// frozen: add fields, never rename or remove them.
//   GET /api/v1/photos?count=N                 → { photos: [...] }        random, one search word each
//   GET /api/v1/photos?id=<id>                 → { photos: [one] }        share links
//   GET /api/v1/photos?download=<id>&ixid=<x>  → { ok: true }             Unsplash download tracking
// Errors: { error: { code, message } } (types/photo-v1.ts). Quota exhaustion → 429 + Retry-After.
import type { ErrorCodeV1, PhotoV1 } from "@/types/photo-v1";

const SEARCH_WORDS = [
  "nature", "architecture", "abstract", "texture", "city", "landscape", "portrait", "street",
  "minimal", "ocean", "mountain", "forest", "desert", "sky", "neon", "vintage", "food", "macro",
  "wildlife", "interior", "fashion", "art", "industrial", "graffiti", "flower", "space", "night",
  "rain", "fog", "sunset", "snow", "autumn", "reflection", "shadow", "pattern", "travel", "fruit",
  "market", "bird", "ceramics",
];

const MAX_COUNT = 10;
const UTM = "utm_source=colour_shift&utm_medium=referral";
const PHOTO_ID = /^[\w-]{1,64}$/;
const IXID = /^[\w-]{1,128}$/;
/** Unsplash's limits reset hourly; ask clients to wait a while, not hammer. */
const RETRY_AFTER_SECONDS = 600;

const NO_STORE = { "Cache-Control": "no-store" };
// Id lookups describe one photo, so they can be cached (credit changes are rare).
const CACHE_ID = { "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" };

type UnsplashPhoto = {
  id: string;
  width: number;
  height: number;
  color: string | null;
  blur_hash: string | null;
  alt_description: string | null;
  urls: { raw: string };
  links: { html: string };
  user: { name: string; links: { html: string } };
};

type Upstream<T> = { ok: true; data: T } | { ok: false; status: number; quota: boolean };

function withUtm(url: string): string {
  return `${url}${url.includes("?") ? "&" : "?"}${UTM}`;
}

function toPhoto(photo: UnsplashPhoto): PhotoV1 {
  return {
    id: photo.id,
    rawUrl: photo.urls.raw,
    alt: photo.alt_description ?? "Unsplash photo",
    photographer: photo.user.name,
    photographerUrl: withUtm(photo.user.links.html),
    photoUrl: withUtm(photo.links.html),
    width: photo.width,
    height: photo.height,
    color: photo.color ?? null,
    blurHash: photo.blur_hash ?? null,
  };
}

/** Unsplash API call that keeps enough of a failure to map it to a stable error. */
async function unsplash<T>(path: string, key: string): Promise<Upstream<T>> {
  try {
    const res = await fetch(`https://api.unsplash.com${path}`, {
      headers: { Authorization: `Client-ID ${key}`, "Accept-Version": "v1" },
      cache: "no-store",
    });
    if (res.ok) return { ok: true, data: (await res.json()) as T };
    // Unsplash signals an exhausted quota with 403 + X-Ratelimit-Remaining: 0 (or 429).
    const quota = res.status === 429 || (res.status === 403 && res.headers.get("x-ratelimit-remaining") === "0");
    return { ok: false, status: res.status, quota };
  } catch {
    return { ok: false, status: 0, quota: false };
  }
}

function error(code: ErrorCodeV1, message: string, status: number, headers: Record<string, string> = {}) {
  return Response.json({ error: { code, message } }, { status, headers: { ...NO_STORE, ...headers } });
}

function rateLimited() {
  return error("rate_limited", "Photo quota used up; try again later", 429, {
    "Retry-After": String(RETRY_AFTER_SECONDS),
  });
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
  if (!key) return error("misconfigured", "Photo service is not configured", 500);

  const params = new URL(request.url).searchParams;
  const id = params.get("id");
  const download = params.get("download");

  if (download !== null) {
    // Server-owned host and path; the client supplies only a validated id and the
    // photo's ixid (from rawUrl), so the request matches links.download_location.
    const ixid = params.get("ixid");
    if (!PHOTO_ID.test(download) || (ixid !== null && !IXID.test(ixid))) {
      return error("invalid_request", "Bad photo id", 400);
    }
    const query = ixid ? `?ixid=${encodeURIComponent(ixid)}` : "";
    const tracked = await unsplash(`/photos/${download}/download${query}`, key);
    if (tracked.ok) return Response.json({ ok: true }, { headers: NO_STORE });
    return tracked.quota ? rateLimited() : error("upstream_unavailable", "Tracking failed", 502);
  }

  if (id !== null) {
    if (!PHOTO_ID.test(id)) return error("invalid_request", "Bad photo id", 400);
    const result = await unsplash<UnsplashPhoto>(`/photos/${id}`, key);
    if (result.ok) return Response.json({ photos: [toPhoto(result.data)] }, { headers: CACHE_ID });
    if (result.quota) return rateLimited();
    return result.status === 404
      ? error("not_found", "Photo not found", 404)
      : error("upstream_unavailable", "Unsplash is unavailable", 502);
  }

  const count = Math.min(Math.max(Number(params.get("count")) || 1, 1), MAX_COUNT);
  const words = shuffled(SEARCH_WORDS).slice(0, count);
  const results = await Promise.all(
    words.map((word) => unsplash<UnsplashPhoto>(`/photos/random?query=${encodeURIComponent(word)}`, key)),
  );
  const photos = results.flatMap((result) => (result.ok ? [toPhoto(result.data)] : []));
  if (photos.length) return Response.json({ photos }, { headers: NO_STORE });
  return results.some((result) => !result.ok && result.quota)
    ? rateLimited()
    : error("upstream_unavailable", "Unsplash returned no photos", 502);
}
