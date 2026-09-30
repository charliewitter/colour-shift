import { PhotoPanel } from "@/components/photo-panel";
import type { Photo } from "@/types/photo";

type StageProps = {
  textHex: string;
  bgHex: string;
  photo: Photo | null;
  onPreviousPhoto: () => void;
  onNextPhoto: () => void;
};

// Colour panel beside photo panel (CONTEXT.md: Stage).
export function Stage({ textHex, bgHex, photo, onPreviousPhoto, onNextPhoto }: StageProps) {
  return (
    <section className="grid min-h-0 flex-1 grid-cols-2">
      <div
        className="flex items-center justify-center"
        style={{ backgroundColor: bgHex, color: textHex }}
      >
        <p className="text-8xl leading-[1.05] tracking-tight">Aa</p>
      </div>
      <PhotoPanel photo={photo} onPrevious={onPreviousPhoto} onNext={onNextPhoto} />
    </section>
  );
}
