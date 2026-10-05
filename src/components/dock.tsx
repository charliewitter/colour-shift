import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/ui/color-picker";
import { Levels } from "@/components/ui/levels";
import { RollText } from "@/components/ui/roll-text";
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
  onPreviousPhoto: () => void;
  onNextPhoto: () => void;
  exportOpen: boolean;
  onToggleExport: () => void;
  /** Resolves true if the link reached the clipboard. */
  onCopyUrl: () => Promise<boolean>;
  onDownload: () => void;
};

// The bar pinned to the bottom (CONTEXT.md: Dock), laid out as Figma `dock`. Desktop only:
// below 640px the bottom bar (bottom-bar.tsx) takes its place.
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
  onPreviousPhoto,
  onNextPhoto,
  exportOpen,
  onToggleExport,
  onCopyUrl,
  onDownload,
}: DockProps) {
  const contrast = getContrast(colors.text, colors.bg, contrastMethod);

  return (
    <footer className="grid h-14 shrink-0 grid-cols-2 items-center bg-canvas p-4 max-sm:hidden">
      <div className="flex items-center justify-between pr-3">
        {/* 4px apart so neighbouring hover/selected fills don't touch (user). */}
        <div className="flex items-center gap-1">
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
          // Beside the score, so it opens sideways: a fade and an 8px slide from the left
          // (@starting-style). Closes instantly, like the font menu.
          <Levels
            className="transition starting:-translate-x-2 starting:opacity-0"
            levels={LEVELS[contrastMethod]}
            passing={getPassingLevel(contrast, contrastMethod)}
            format={(level) => formatLevel(level, contrastMethod)}
            onSelect={onChooseLevel}
          />
        )}
        <Score open={levelsOpen} onClick={onToggleLevels}>
          {formatScore(colors.text, colors.bg, contrastMethod)}
        </Score>
        {/* Figma `export`, pushed right: photo arrows, then EXPORT or its options. */}
        <div className="ml-auto flex items-center gap-[7px]">
          <div className="flex items-center gap-2">
            <Button icon aria-label="Previous photo" onClick={onPreviousPhoto}>
              <Image src="/icons/arrow-left.svg" alt="" width={16} height={16} />
            </Button>
            <Button icon aria-label="Next photo" onClick={onNextPhoto}>
              <Image src="/icons/arrow-right.svg" alt="" width={16} height={16} />
            </Button>
          </div>
          <ExportControls open={exportOpen} onToggle={onToggleExport} onCopyUrl={onCopyUrl} onDownload={onDownload} />
        </div>
      </div>
    </footer>
  );
}

type Done = "copy" | "download" | null;

// EXPORT, or once open: COPY URL, DOWNLOAD .MD, CLOSE (Figma `export`). After an action its
// label confirms for 1.5s (COPIED, DOWNLOADED). Focus moves to COPY URL on open and back
// to EXPORT on close (Esc unmounts a focused option), so keyboard users aren't dropped.
// Also the bottom bar's fallback when the browser has no share sheet.
export function ExportControls({
  open,
  onToggle,
  onCopyUrl,
  onDownload,
}: {
  open: boolean;
  onToggle: () => void;
  onCopyUrl: () => Promise<boolean>;
  onDownload: () => void;
}) {
  const [done, setDone] = useState<Done>(null);
  const timer = useRef<number>(undefined);
  const exportButton = useRef<HTMLButtonElement>(null);
  const copyButton = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(open);

  useEffect(() => {
    if (open) copyButton.current?.focus();
    else if (wasOpen.current) exportButton.current?.focus();
    wasOpen.current = open;
  }, [open]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function confirm(action: Done) {
    setDone(action);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setDone(null), 1500);
  }

  // One toggle button that stays put: its label rolls EXPORT ⇄ CLOSE. The options fade in with
  // a small drop to its left (@starting-style) and close instantly.
  return (
    <div className="flex items-center gap-[7px]">
      {open && (
        <div className="flex items-center gap-[7px] transition starting:-translate-y-1 starting:opacity-0">
          <Button ref={copyButton} onClick={async () => (await onCopyUrl()) && confirm("copy")}>
            <StableLabel label={done === "copy" ? "COPIED" : "COPY URL"} longest="COPY URL" />
          </Button>
          <Button
            onClick={() => {
              onDownload();
              confirm("download");
            }}
          >
            <StableLabel label={done === "download" ? "DOWNLOADED" : "DOWNLOAD .MD"} longest="DOWNLOAD .MD" />
          </Button>
        </div>
      )}
      <Button ref={exportButton} selected={open} aria-expanded={open} onClick={onToggle}>
        <RollText>{open ? "CLOSE" : "EXPORT"}</RollText>
      </Button>
    </div>
  );
}

// Reserves the longest label's width, so confirming doesn't nudge the buttons beside it.
function StableLabel({ label, longest }: { label: string; longest: string }) {
  return (
    <span className="grid" aria-live="polite">
      <span className="invisible col-start-1 row-start-1" aria-hidden>
        {longest}
      </span>
      <span className="col-start-1 row-start-1">{label}</span>
    </span>
  );
}
