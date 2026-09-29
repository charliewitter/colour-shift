import Image from "next/image";
import type { Role } from "@/components/color-shift";
import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/ui/color-picker";
import { Score } from "@/components/ui/score";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { formatScore, toHex, type Color, type ContrastMethod } from "@/lib/color-engine";

const CONTRAST_METHODS = [
  { value: "wcag", label: "WCAG" },
  { value: "apca", label: "APCA" },
] as const;

type DockProps = {
  colors: Record<Role, Color>;
  activeRole: Role | null;
  contrastMethod: ContrastMethod;
  onSelectRole: (role: Role) => void;
  onSwap: () => void;
  onContrastMethodChange: (method: ContrastMethod) => void;
};

// The bar pinned to the bottom (CONTEXT.md: Dock), laid out as Figma `dock` (panel=none).
// Three columns so the contrast controls sit dead centre whatever the sides hold.
export function Dock({ colors, activeRole, contrastMethod, onSelectRole, onSwap, onContrastMethodChange }: DockProps) {
  return (
    <footer className="grid h-14 shrink-0 grid-cols-[1fr_auto_1fr] items-center bg-canvas p-4">
      <div className="flex items-center">
        <ColorPicker
          label="Text colour"
          hex={toHex(colors.text)}
          active={activeRole === "text"}
          onClick={() => onSelectRole("text")}
        />
        <Button icon aria-label="Swap colours" onClick={onSwap}>
          <Image src="/icons/repeat.svg" alt="" width={16} height={16} />
        </Button>
        <ColorPicker
          label="Background colour"
          hex={toHex(colors.bg)}
          active={activeRole === "bg"}
          onClick={() => onSelectRole("bg")}
        />
      </div>

      <div className="flex items-center gap-6">
        <SegmentedControl
          label="Contrast method"
          options={CONTRAST_METHODS}
          value={contrastMethod}
          onChange={onContrastMethodChange}
        />
        <Score>{formatScore(colors.text, colors.bg, contrastMethod)}</Score>
      </div>

      {/* Photo arrows (step 3) and export (step 5) go here. */}
      <div />
    </footer>
  );
}
