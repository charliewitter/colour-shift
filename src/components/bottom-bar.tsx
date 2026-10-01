import Image from "next/image";
import { useEffect, useRef } from "react";
import { ExportControls } from "@/components/dock";
import { Button } from "@/components/ui/button";
import { Levels } from "@/components/ui/levels";
import { Reveal } from "@/components/ui/reveal";
import { Score } from "@/components/ui/score";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  LEVELS,
  formatLevel,
  formatScore,
  getContrast,
  getPassingLevel,
  readableOn,
  toHex,
  type Color,
  type ContrastMethod,
  type Pair,
  type Role,
} from "@/lib/color-engine";

const CONTRAST_METHODS = [
  { value: "wcag", label: "WCAG" },
  { value: "apca", label: "APCA" },
] as const;

// Swatch row columns: text · swap · background. The active colour's block takes half the width.
const SWATCH_COLUMNS: Record<Role | "none", string> = {
  none: "1fr 1fr 1fr",
  text: "2fr 1fr 1fr",
  bg: "1fr 1fr 2fr",
};

type BottomBarProps = {
  colors: Pair;
  activeRole: Role | null;
  contrastMethod: ContrastMethod;
  levelsOpen: boolean;
  onToggleLevels: () => void;
  onChooseLevel: (level: number) => void;
  onSelectRole: (role: Role) => void;
  onSwap: () => void;
  onContrastMethodChange: (method: ContrastMethod) => void;
  onShare: () => void;
  exportOpen: boolean;
  onToggleExport: () => void;
  onCopyUrl: () => Promise<boolean>;
  onDownload: () => void;
};

// The mobile dock (CONTEXT.md: Bottom bar), from Figma `bottom bar`. Below 640px only.
// Swatch row on top, then the levels (when open), then the contrast row. The slider panel
// sits above it in color-shift.tsx, so panels open upwards and push the stage up.
export function BottomBar({
  colors,
  activeRole,
  contrastMethod,
  levelsOpen,
  onToggleLevels,
  onChooseLevel,
  onSelectRole,
  onSwap,
  onContrastMethodChange,
  onShare,
  exportOpen,
  onToggleExport,
  onCopyUrl,
  onDownload,
}: BottomBarProps) {
  const contrast = getContrast(colors.text, colors.bg, contrastMethod);
  const shareButton = useRef<HTMLButtonElement>(null);
  const wasExportOpen = useRef(exportOpen);

  // The export options replace the share button, so closing them hands focus back to it.
  useEffect(() => {
    if (wasExportOpen.current && !exportOpen) shareButton.current?.focus();
    wasExportOpen.current = exportOpen;
  }, [exportOpen]);

  return (
    // Safe-area padding keeps the controls clear of the home bar (layout.tsx: viewport-fit=cover).
    <footer className="shrink-0 bg-canvas pb-[env(safe-area-inset-bottom)] sm:hidden">
      <div
        className="grid h-16 transition-[grid-template-columns]"
        style={{ gridTemplateColumns: SWATCH_COLUMNS[activeRole ?? "none"] }}
      >
        <SwatchBlock label="Text colour" color={colors.text} active={activeRole === "text"} onClick={() => onSelectRole("text")} />
        <button
          type="button"
          aria-label="Swap colours"
          onClick={onSwap}
          className="flex items-center justify-center transition active:bg-surface-raised focus-visible:outline focus-visible:-outline-offset-1 focus-visible:outline-focus"
        >
          <Image src="/icons/repeat.svg" alt="" width={24} height={24} />
        </button>
        <SwatchBlock label="Background colour" color={colors.bg} active={activeRole === "bg"} onClick={() => onSelectRole("bg")} />
      </div>

      <div className="flex flex-col px-4 py-3">
        {/* The 16px gap lives inside the panel, so it collapses with it. */}
        <Reveal open={levelsOpen}>
          <div className="pb-4">
            <Levels
              stretch
              levels={LEVELS[contrastMethod]}
              passing={getPassingLevel(contrast, contrastMethod)}
              format={(level) => formatLevel(level, contrastMethod)}
              onSelect={onChooseLevel}
            />
          </div>
        </Reveal>
        <div className="flex h-10 items-center justify-between">
          {exportOpen ? (
            // No share sheet on this device: the desktop export options take over the row.
            <div className="ml-auto flex items-center gap-[7px]">
              <ExportControls open onToggle={onToggleExport} onCopyUrl={onCopyUrl} onDownload={onDownload} />
            </div>
          ) : (
            <>
              <div className="flex h-full items-stretch gap-3">
                <SegmentedControl
                  label="Contrast method"
                  options={CONTRAST_METHODS}
                  value={contrastMethod}
                  onChange={onContrastMethodChange}
                />
                {/* Outline at rest, filled while the levels are open (Figma `bottom bar`). */}
                <Score
                  open={levelsOpen}
                  onClick={onToggleLevels}
                  className={`px-3 ${levelsOpen ? "bg-surface-raised" : "inset-ring inset-ring-surface-raised"}`}
                >
                  {formatScore(colors.text, colors.bg, contrastMethod)}
                </Score>
              </div>
              <Button ref={shareButton} icon aria-label="Share" onClick={onShare} className="p-2">
                <Image src="/icons/share.svg" alt="" width={24} height={24} />
              </Button>
            </>
          )}
        </div>
      </div>
    </footer>
  );
}

// One colour as a full-height block, its hex on top in black or white (whichever reads better).
// Selecting it makes it the active colour; the wider column shows which one that is.
function SwatchBlock({
  label,
  color,
  active,
  onClick,
}: {
  label: string;
  color: Color;
  active: boolean;
  onClick: () => void;
}) {
  const hex = toHex(color);
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      // Hairline edge (like the desktop swatch) so a colour close to the dock's still shows its bounds.
      className="flex min-w-0 items-center justify-center shadow-[inset_0_0_0_0.5px_var(--cs-swatch-edge)] focus-visible:outline focus-visible:-outline-offset-2 focus-visible:outline-focus"
      style={{ backgroundColor: hex, color: readableOn(color) }}
    >
      <span className="sr-only">{label}</span>
      <span className="truncate uppercase">{hex}</span>
    </button>
  );
}
