import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/ui/color-picker";
import { Levels } from "@/components/ui/levels";
import { Score } from "@/components/ui/score";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  LEVELS,
  formatLevel,
  formatScore,
  getContrast,
  getPassingLevel,
  toHex,
  type ContrastMethod,
  type Pair,
  type Role,
} from "@/lib/color-engine";

const CONTRAST_METHODS = [
  { value: "wcag", label: "WCAG" },
  { value: "apca", label: "APCA" },
] as const;

type DockProps = {
  colors: Pair;
  activeRole: Role | null;
  contrastMethod: ContrastMethod;
  levelsOpen: boolean;
  onToggleLevels: () => void;
  onChooseLevel: (level: number) => void;
  onSelectRole: (role: Role) => void;
  onSwap: () => void;
  onContrastMethodChange: (method: ContrastMethod) => void;
};

// The bar pinned to the bottom (CONTEXT.md: Dock), laid out as Figma `dock`.
// Two equal halves with a 24px gap centred on the page: the switch ends 12px left of centre, the levels
// and score start 12px right of it and grow rightwards, so the switch never moves whatever the score says.
export function Dock({
  colors,
  activeRole,
  contrastMethod,
  levelsOpen,
  onToggleLevels,
  onChooseLevel,
  onSelectRole,
  onSwap,
  onContrastMethodChange,
}: DockProps) {
  const contrast = getContrast(colors.text, colors.bg, contrastMethod);

  return (
    <footer className="grid h-14 shrink-0 grid-cols-2 items-center bg-canvas p-4">
      <div className="flex items-center justify-between pr-3">
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
        <SegmentedControl
          label="Contrast method"
          options={CONTRAST_METHODS}
          value={contrastMethod}
          onChange={onContrastMethodChange}
        />
      </div>

      <div className="flex items-center gap-6 pl-3">
        {levelsOpen && (
          <Levels
            levels={LEVELS[contrastMethod]}
            passing={getPassingLevel(contrast, contrastMethod)}
            format={(level) => formatLevel(level, contrastMethod)}
            onSelect={onChooseLevel}
          />
        )}
        <Score open={levelsOpen} onClick={onToggleLevels}>
          {formatScore(colors.text, colors.bg, contrastMethod)}
        </Score>
        {/* Photo arrows (step 3) and export (step 5) go here, pushed right with ml-auto. */}
      </div>
    </footer>
  );
}
