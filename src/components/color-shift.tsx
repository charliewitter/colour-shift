"use client";

import { useEffect, useRef, useState } from "react";
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
import { extractPair, fetchRandomPhotos, trackDownload } from "@/lib/photos";
import type { Photo } from "@/types/photo";

// Shown until the first photo's pair arrives (Figma's mockup pair). Darker colour as background.
const START_COLORS: Pair = {
  text: fromHex("#ff6f91"),
  bg: fromHex("#3a1020"),
};

// Photos fetched per request: enough to step forward a few times without waiting.
const PHOTO_BATCH = 3;

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
  // Photos seen so far, in order, and which one is showing. ← walks back through them.
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [photoIndex, setPhotoIndex] = useState(0);
  const loadingPhotos = useRef(false);
  const tracked = useRef(new Set<string>());
  const photo = photos[photoIndex] ?? null;

  // A batch of random photos, or none if one is already on its way (or the request failed).
  // The guard also stops React's dev-mode double effect from spending two API calls.
  async function requestPhotos(): Promise<Photo[]> {
    if (loadingPhotos.current) return [];
    loadingPhotos.current = true;
    try {
      return await fetchRandomPhotos(PHOTO_BATCH);
    } catch (error) {
      console.error(error);
      return [];
    } finally {
      loadingPhotos.current = false;
    }
  }

  // First batch on load.
  useEffect(() => {
    requestPhotos().then((batch) => setPhotos((current) => [...current, ...batch]));
  }, []);

  // A new photo brings its own pair. It counts as the user's choice, so it sets the anchors too
  // (docs/adr/0005). If the user moves on before extraction finishes, the stale result is dropped.
  useEffect(() => {
    if (!photo) return;
    if (!tracked.current.has(photo.id)) {
      tracked.current.add(photo.id);
      trackDownload(photo);
    }
    let current = true;
    extractPair(photo).then((pair) => {
      if (!current || !pair) return;
      setColors(pair);
      setAnchors(pair);
    });
    return () => {
      current = false;
    };
  }, [photo]);

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

  function previousPhoto() {
    setPhotoIndex((index) => Math.max(0, index - 1));
  }

  // Steps forward; at the end of the list it fetches more and moves once they arrive.
  async function nextPhoto() {
    if (photoIndex < photos.length - 1) {
      setPhotoIndex(photoIndex + 1);
      return;
    }
    const batch = await requestPhotos();
    if (batch.length === 0) return;
    setPhotos((current) => [...current, ...batch]);
    setPhotoIndex((index) => index + 1);
  }

  const textHex = toHex(colors.text);
  const bgHex = toHex(colors.bg);

  return (
    <main className="flex h-dvh flex-col">
      <Stage
        textHex={textHex}
        bgHex={bgHex}
        photo={photo}
        onPreviousPhoto={previousPhoto}
        onNextPhoto={nextPhoto}
      />
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
        onPreviousPhoto={previousPhoto}
        onNextPhoto={nextPhoto}
      />
    </main>
  );
}
