import { PhotoPanel } from "@/components/photo-panel";
import type { Photo } from "@/types/photo";

type StageProps = {
  textHex: string;
  bgHex: string;
  /** Colours came from a photo: crossfade to them, trailing the photo slightly (0.1s delay, 0.7s).
   *  Hand edits stay instant so sliders don't lag. */
  fadeColors: boolean;
  photo: Photo | null;
  photoIndex: number;
  onPreviousPhoto: () => void;
  onNextPhoto: () => void;
};

// Colour panel beside photo panel (CONTEXT.md: Stage).
export function Stage({ textHex, bgHex, fadeColors, photo, photoIndex, onPreviousPhoto, onNextPhoto }: StageProps) {
  return (
    <section className="grid min-h-0 flex-1 grid-cols-2">
      <div
        className={`flex items-center justify-center ${fadeColors ? "transition-colors delay-100 duration-700" : ""}`}
        style={{ backgroundColor: bgHex, color: textHex }}
      >
        <p className="text-8xl leading-[1.05] tracking-tight">Aa</p>
      </div>
      <PhotoPanel photo={photo} index={photoIndex} onPrevious={onPreviousPhoto} onNext={onNextPhoto} />
    </section>
  );
}
