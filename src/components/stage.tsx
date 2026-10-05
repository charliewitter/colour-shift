import type { CSSProperties } from "react";
import { PhotoPanel } from "@/components/photo-panel";
import { SampleText } from "@/components/sample-text";
import { Dropdown } from "@/components/ui/dropdown";
import { SPECIMEN_FONTS, specimenFont, type SpecimenFontId } from "@/lib/fonts";
import type { Photo } from "@/types/photo";

type StageProps = {
  textHex: string;
  bgHex: string;
  photo: Photo | null;
  photoIndex: number;
  sampleText: string;
  onSampleTextChange: (text: string) => void;
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
  photo,
  photoIndex,
  sampleText,
  onSampleTextChange,
  font,
  fontMenuOpen,
  onToggleFontMenu,
  onChooseFont,
  onCloseFontMenu,
  onPreviousPhoto,
  onNextPhoto,
}: StageProps) {
  return (
    // Side by side on desktop; stacked on mobile, colour panel on top (Figma `stage`, layout=mobile).
    // On mobile the colour panel keeps at least 160px while panels open below; the photo gives way first.
    <section className="grid min-h-0 flex-1 grid-cols-2 max-sm:grid-cols-1 max-sm:grid-rows-[minmax(160px,1fr)_minmax(0,1fr)]">
      <div
        // Colour fade timing comes from <main> (color-shift.tsx): 0ms while dragging.
        className="relative flex items-center justify-center transition-colors delay-(--colour-fade-delay) duration-(--colour-fade-duration)"
        style={
          {
            backgroundColor: bgHex,
            color: textHex,
          } as CSSProperties
        }
      >
        <div className="absolute top-4 left-4 z-10">
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
        <SampleText
          text={sampleText}
          fontFamily={specimenFont(font).family}
          textHex={textHex}
          onChange={onSampleTextChange}
        />
      </div>
      <PhotoPanel photo={photo} index={photoIndex} onPrevious={onPreviousPhoto} onNext={onNextPhoto} />
    </section>
  );
}
