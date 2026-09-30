import { PhotoPanel } from "@/components/photo-panel";
import { Dropdown } from "@/components/ui/dropdown";
import { SPECIMEN_FONTS, specimenFont, type SpecimenFontId } from "@/lib/fonts";
import type { Photo } from "@/types/photo";

type StageProps = {
  textHex: string;
  bgHex: string;
  /** Colours came from a photo: crossfade to them, trailing the photo slightly (0.1s delay, 0.7s).
   *  Hand edits stay instant so sliders don't lag. */
  fadeColors: boolean;
  photo: Photo | null;
  photoIndex: number;
  font: SpecimenFontId;
  fontMenuOpen: boolean;
  onToggleFontMenu: () => void;
  onChooseFont: (font: SpecimenFontId) => void;
  onCloseFontMenu: () => void;
  onPreviousPhoto: () => void;
  onNextPhoto: () => void;
};

// Colour panel beside photo panel (CONTEXT.md: Stage).
export function Stage({
  textHex,
  bgHex,
  fadeColors,
  photo,
  photoIndex,
  font,
  fontMenuOpen,
  onToggleFontMenu,
  onChooseFont,
  onCloseFontMenu,
  onPreviousPhoto,
  onNextPhoto,
}: StageProps) {
  return (
    <section className="grid min-h-0 flex-1 grid-cols-2">
      <div
        className={`relative flex items-center justify-center ${fadeColors ? "transition-colors delay-100 duration-700" : ""}`}
        style={{ backgroundColor: bgHex, color: textHex }}
      >
        <div className="absolute top-4 left-4">
          <Dropdown
            label="Specimen font"
            options={SPECIMEN_FONTS}
            value={font}
            open={fontMenuOpen}
            onToggle={onToggleFontMenu}
            onChoose={onChooseFont}
            onClose={onCloseFontMenu}
          />
        </div>
        {/* The chosen font is state, so it's set inline like the colours. */}
        <p className="text-8xl leading-[1.05] tracking-[-0.02em]" style={{ fontFamily: specimenFont(font).family }}>
          Aa
        </p>
      </div>
      <PhotoPanel photo={photo} index={photoIndex} onPrevious={onPreviousPhoto} onNext={onNextPhoto} />
    </section>
  );
}
