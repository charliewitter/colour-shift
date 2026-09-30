import Image from "next/image";
import { photoSrc } from "@/lib/photos";
import type { Photo } from "@/types/photo";

type PhotoPanelProps = {
  photo: Photo | null;
  onPrevious: () => void;
  onNext: () => void;
};

// The current photo (Figma `photo panel`): fills its half of the stage, credit bottom-right,
// arrows at the sides that show on hover (or keyboard focus).
export function PhotoPanel({ photo, onPrevious, onNext }: PhotoPanelProps) {
  return (
    <div className="group relative overflow-hidden bg-surface-raised">
      {photo && (
        <>
          {/* Plain <img>, not next/image: Unsplash already resizes via URL params, so
              Vercel's image optimiser would only add cost and a second resize. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img key={photo.id} src={photoSrc(photo)} alt={photo.alt} className="absolute inset-0 size-full object-cover" />
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
        </>
      )}
      <PhotoArrow direction="left" label="Previous photo" onClick={onPrevious} />
      <PhotoArrow direction="right" label="Next photo" onClick={onNext} />
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
