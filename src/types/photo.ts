// One Unsplash photo, trimmed to what the app uses. `/api/photos` returns these.
export type Photo = {
  id: string;
  /** imgix base URL; add `w=` etc. for a sized copy (Unsplash resizes on the fly). */
  rawUrl: string;
  alt: string;
  photographer: string;
  /** Photographer and photo pages, with Unsplash's required UTM tags. */
  photographerUrl: string;
  photoUrl: string;
};
