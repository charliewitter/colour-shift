// /api/v1/photos: the stable contract for the native iOS client (ios.md §7).
// Additive changes only within v1; anything breaking needs /api/v2.
import type { Photo } from "@/types/photo";

export type PhotoV1 = Photo & {
  width: number;
  height: number;
  /** Unsplash's average colour, e.g. "#c0a080", or null. */
  color: string | null;
  /** BlurHash placeholder, or null. */
  blurHash: string | null;
};

/** Every success: random batches and id lookups (one element) alike. */
export type PhotosResponseV1 = { photos: PhotoV1[] };

export type ErrorCodeV1 =
  | "invalid_request" // 400: bad id or parameters
  | "not_found" // 404: no such photo
  | "rate_limited" // 429: Unsplash quota used up; see Retry-After
  | "upstream_unavailable" // 502: Unsplash failed or returned nothing
  | "misconfigured"; // 500: server has no Unsplash key

export type ErrorResponseV1 = { error: { code: ErrorCodeV1; message: string } };
