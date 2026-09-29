"use client";

import { useState } from "react";
import { Dock } from "@/components/dock";
import { Stage } from "@/components/stage";
import type { ContrastMethod } from "@/lib/color-engine";

// Starting pair until photos arrive in step 3 (Figma's mockup pair). Darker colour as background.
const START_TEXT_COLOR = "#ff6f91";
const START_BG_COLOR = "#3a1020";

// The whole app. All state lives here (APP-SPEC: one top-level component); children get values and callbacks.
export function ColorShift() {
  const [textColor, setTextColor] = useState(START_TEXT_COLOR);
  const [bgColor, setBgColor] = useState(START_BG_COLOR);
  const [contrastMethod, setContrastMethod] = useState<ContrastMethod>("wcag");

  function swap() {
    setTextColor(bgColor);
    setBgColor(textColor);
  }

  return (
    <main className="flex h-dvh flex-col">
      <Stage textColor={textColor} bgColor={bgColor} />
      <Dock
        textColor={textColor}
        bgColor={bgColor}
        contrastMethod={contrastMethod}
        onSwap={swap}
        onContrastMethodChange={setContrastMethod}
      />
    </main>
  );
}
