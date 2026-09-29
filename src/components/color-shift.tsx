"use client";

import { useEffect, useState } from "react";
import { Dock } from "@/components/dock";
import { SliderPanel } from "@/components/slider-panel";
import { Stage } from "@/components/stage";
import {
  fromHex,
  reachLevel,
  toHex,
  type Color,
  type ColorMode,
  type ContrastMethod,
  type Pair,
  type Role,
} from "@/lib/color-engine";

// Starting pair until photos arrive in step 3 (Figma's mockup pair). Darker colour as background.
const START_COLORS: Pair = {
  text: fromHex("#ff6f91"),
  bg: fromHex("#3a1020"),
};

// The whole app. All state lives here (APP-SPEC: one top-level component); children get values and callbacks.
export function ColorShift() {
  const [colors, setColors] = useState(START_COLORS);
  // Each colour as the user last set it (CONTEXT.md: Anchor colour). Levels work from these,
  // so repeated level clicks never compound gamut losses (docs/adr/0005).
  const [anchors, setAnchors] = useState(START_COLORS);
  const [activeRole, setActiveRole] = useState<Role | null>(null);
  const [colorMode, setColorMode] = useState<ColorMode>("hsb");
  const [contrastMethod, setContrastMethod] = useState<ContrastMethod>("wcag");
  const [levelsOpen, setLevelsOpen] = useState(false);

  // Esc closes any open panel.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setActiveRole(null);
      setLevelsOpen(false);
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
    setAnchors(({ text, bg }) => ({ text: bg, bg: text }));
    setActiveRole((current) => (current === "text" ? "bg" : current === "bg" ? "text" : null));
  }

  // A slider edit is the user setting the colour: it becomes the new anchor.
  function editColor(role: Role, color: Color) {
    setColors((current) => ({ ...current, [role]: color }));
    setAnchors((current) => ({ ...current, [role]: color }));
  }

  // The active colour moves; with none active, the text colour does (CONTEXT.md: Level).
  // It moves from its anchor, not from wherever the last level click left it.
  function chooseLevel(level: number) {
    const role = activeRole ?? "text";
    setColors((current) => {
      const start = { ...current, [role]: anchors[role] };
      return { ...current, [role]: reachLevel(start, role, level, contrastMethod) };
    });
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
          onColorChange={(color) => editColor(activeRole, color)}
          onColorModeChange={setColorMode}
        />
      )}
      <Dock
        colors={colors}
        activeRole={activeRole}
        contrastMethod={contrastMethod}
        levelsOpen={levelsOpen}
        onToggleLevels={() => setLevelsOpen((open) => !open)}
        onChooseLevel={chooseLevel}
        onSelectRole={selectRole}
        onSwap={swap}
        onContrastMethodChange={setContrastMethod}
      />
    </main>
  );
}
