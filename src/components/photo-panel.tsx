import Image from "next/image";
import { useState } from "react";
import { photoSrc, previewSrc } from "@/lib/photos";
import type { Photo } from "@/types/photo";

type PhotoPanelProps = {
  photo: Photo | null;
  /** Position in the photo stream: going up slides the new photo in from the right, down from the left. */
  index: number;
  onPrevious: () => void;
  onNext: () => void;
};

type Leaving = { photo: Photo; forward: boolean };

// The current photo (Figma `photo panel`): fills its half of the stage, credit bottom-right,
// arrows at the sides that show on hover (or keyboard focus). A new photo slides in while the
// old one slides out; the old one is kept here (visual-only state) until its slide ends.
export function PhotoPanel({ photo, index, onPrevious, onNext }: PhotoPanelProps) {
  const [current, setCurrent] = useState({ photo, index });
  const [leaving, setLeaving] = useState<Leaving | null>(null);

  // Photo changed: the one showing becomes the leaving one. Set during render so both layers
  // appear in the same paint (no frame with the new photo sitting still).
  if (photo !== current.photo) {
    const forward = index >= current.index;
    setLeaving(current.photo ? { photo: current.photo, forward } : null);
    setCurrent({ photo, index });
  }

  return (
    <div className="group relative overflow-hidden bg-surface-raised">
      {leaving && (
        <PhotoLayer
          key={leaving.photo.id}
          photo={leaving.photo}
          className={leaving.forward ? "animate-slide-out-left" : "animate-slide-out-right"}
          onAnimationEnd={() => setLeaving(null)}
        />
      )}
      {current.photo && (
        <PhotoLayer
          key={current.photo.id}
          photo={current.photo}
          preview={leaving !== null}
          className={leaving ? (leaving.forward ? "animate-slide-in-right" : "animate-slide-in-left") : ""}
        />
      )}
      {photo && (
        <p className="absolute right-4 bottom-4 text-value">
          Photo by{" "}
          <a href={photo.photographerUrl} target="_blank" rel="noreferrer" className="hover:text-strong">
            {photo.photographer}
          </a>{" "}
          on{" "}
          <a href={photo.photoUrl} target="_blank" rel="noreferrer" className="hover:text-strong">
            Unsplash
          </a>
        </p>
      )}
      <PhotoArrow direction="left" label="Previous photo" onClick={onPrevious} />
      <PhotoArrow direction="right" label="Next photo" onClick={onNext} />
    </div>
  );
}

// One photo filling the panel: the small extraction copy, blurred, until the full photo has loaded
// and faded in over it. Keyed by photo, so `loaded` starts fresh for each one.
// No preview for the first photo (nothing to slide from): it just fades in quickly from the dark panel.
function PhotoLayer({
  photo,
  preview = true,
  className,
  onAnimationEnd,
}: {
  photo: Photo;
  /** Read once, on mount: the layer keeps its preview after the slide ends. */
  preview?: boolean;
  className: string;
  onAnimationEnd?: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [withPreview] = useState(preview);

  return (
    <div
      className={`absolute inset-0 overflow-hidden ${className}`}
      onAnimationEnd={(event) => event.target === event.currentTarget && onAnimationEnd?.()}
    >
      {/* Plain <img>, not next/image: Unsplash already resizes via URL params, so
          Vercel's image optimiser would only add cost and a second resize. */}
      {withPreview && (
        // crossOrigin matches how node-vibrant fetched this copy, so the browser reuses it from cache.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previewSrc(photo)} alt="" crossOrigin="anonymous" className="absolute inset-0 size-full scale-110 object-cover blur-xl" />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photoSrc(photo)}
        alt={photo.alt}
        onLoad={() => setLoaded(true)}
        className={`absolute inset-0 size-full object-cover transition-opacity ${withPreview ? "duration-400" : ""} ${loaded ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  );
}

function PhotoArrow({ direction, label, onClick }: { direction: "left" | "right"; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={[
        "absolute top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-[4px] bg-canvas",
        "opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100",
        "active:scale-95 focus-visible:outline focus-visible:outline-focus",
        direction === "left" ? "left-4" : "right-4",
      ].join(" ")}
    >
      <Image src={`/icons/arrow-${direction}.svg`} alt="" width={20} height={20} />
    </button>
  );
}
