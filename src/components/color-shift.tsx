"use client";

import { useEffect, useState } from "react";
import { Dock } from "@/components/dock";
import { SliderPanel } from "@/components/slider-panel";
import { Stage } from "@/components/stage";
import { fromHex, toHex, type Color, type ColorMode, type ContrastMethod } from "@/lib/color-engine";

export type Role = "text" | "bg";

// Starting pair until photos arrive in step 3 (Figma's mockup pair). Darker colour as background.
const START_COLORS: Record<Role, Color> = {
  text: fromHex("#ff6f91"),
  bg: fromHex("#3a1020"),
};

// The whole app. All state lives here (APP-SPEC: one top-level component); children get values and callbacks.
export function ColorShift() {
  const [colors, setColors] = useState(START_COLORS);
  const [activeRole, setActiveRole] = useState<Role | null>(null);
  const [colorMode, setColorMode] = useState<ColorMode>("hsb");
  const [contrastMethod, setContrastMethod] = useState<ContrastMethod>("wcag");

  // Esc closes any open panel.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setActiveRole(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Same picker again closes; the other one switches.
  function selectRole(role: Role) {
    setActiveRole((current) => (current === role ? null : role));
  }

  // The active colour follows its value into the new role (CONTEXT.md: Active colour).
  function swap() {
    setColors(({ text, bg }) => ({ text: bg, bg: text }));
    setActiveRole((current) => (current === "text" ? "bg" : current === "bg" ? "text" : null));
  }

  const textHex = toHex(colors.text);
  const bgHex = toHex(colors.bg);

  return (
    <main className="flex h-dvh flex-col">
      <Stage textHex={textHex} bgHex={bgHex} />
      {activeRole && (
        <SliderPanel
          color={colors[activeRole]}
          colorMode={colorMode}
          onColorChange={(color) => setColors((current) => ({ ...current, [activeRole]: color }))}
          onColorModeChange={setColorMode}
        />
      )}
      <Dock
        colors={colors}
        activeRole={activeRole}
        contrastMethod={contrastMethod}
        onSelectRole={selectRole}
        onSwap={swap}
        onContrastMethodChange={setContrastMethod}
      />
    </main>
  );
}
