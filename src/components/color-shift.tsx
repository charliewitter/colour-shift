"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
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
import { extractPair, fetchRandomPhotos, preloadPhoto, trackDownload } from "@/lib/photos";
import type { Photo } from "@/types/photo";

// An empty dark panel (--cs-surface, text the same so "Aa" is invisible) until the first photo's pair fades in.
const START_COLORS: Pair = {
  text: fromHex("#1a1718"),
  bg: fromHex("#1a1718"),
};

// Photos fetched per request, and how many to keep loaded ahead of the current one.
const PHOTO_BATCH = 3;
const PHOTOS_AHEAD = 3;

// Keys typed here belong to the field, not to photo navigation.
function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

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
  // The photo stream, in order, and which one is showing. ← walks back; the rest are loaded ahead.
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [photoIndex, setPhotoIndex] = useState(0);
  // Each photo's pair, extracted as soon as the photo arrives, so showing it is instant.
  const [pairs, setPairs] = useState<Record<string, Pair>>({});
  // Which photo's pair the colours were last set from (null while the current one is still extracting).
  const [pairFor, setPairFor] = useState<string | null>(null);
  // True when the colours last came from a photo (they crossfade), false after a hand edit (instant).
  const [fadeColors, setFadeColors] = useState(false);
  const loadingPhotos = useRef(false);
  const prepared = useRef(new Set<string>());
  const shown = useRef(new Set<string>());
  const photo = photos[photoIndex] ?? null;
  const pair = photo ? pairs[photo.id] : undefined;
  const photosAhead = photos.length - 1 - photoIndex;

  // A new photo brings its own pair. It counts as the user's choice, so it sets the anchors too
  // (docs/adr/0005). Set during render rather than in an effect: React's pattern for state that
  // follows other state, and it lands in the same paint as the photo.
  if (photo && pair && pairFor !== photo.id) {
    setPairFor(photo.id);
    setFadeColors(true);
    setColors(pair);
    setAnchors(pair);
  } else if (photo && !pair && pairFor !== null) {
    setPairFor(null);
  }

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

  // Keeps PHOTOS_AHEAD photos loaded past the current one (this is also the first load).
  useEffect(() => {
    if (photosAhead >= PHOTOS_AHEAD) return;
    requestPhotos().then((batch) => {
      if (batch.length) setPhotos((current) => [...current, ...batch]);
    });
  }, [photosAhead]);

  // Each photo, once, as it arrives: start downloading it and extract its pair.
  useEffect(() => {
    for (const next of photos) {
      if (prepared.current.has(next.id)) continue;
      prepared.current.add(next.id);
      preloadPhoto(next);
      extractPair(next).then((extracted) => {
        if (extracted) setPairs((current) => ({ ...current, [next.id]: extracted }));
      });
    }
  }, [photos]);

  // Unsplash counts a photo as used when it's shown, not when it's loaded ahead.
  useEffect(() => {
    if (!photo || shown.current.has(photo.id)) return;
    shown.current.add(photo.id);
    trackDownload(photo);
  }, [photo]);

  // ← → step through photos and Space jumps to a new one (not while typing). Esc closes any open panel.
  // useEffectEvent: the listener is added once but always sees the latest state.
  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === "Escape") {
      setActiveRole(null);
      setLevelsOpen(false);
      return;
    }
    if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
    if (event.key === "ArrowLeft") previousPhoto();
    else if (event.key === "ArrowRight") nextPhoto();
    else if (event.key === " ") {
      // Space on a focused button presses that button instead.
      if (event.target instanceof HTMLButtonElement) return;
      event.preventDefault();
      jumpPhoto();
    }
  });

  useEffect(() => {
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Same picker again closes; the other one switches.
  function selectRole(role: Role) {
    setActiveRole((current) => (current === role ? null : role));
  }

  // The active colour follows its value into the new role (CONTEXT.md: Active colour).
  function swap() {
    setFadeColors(false);
    setColors(({ text, bg }) => ({ text: bg, bg: text }));
    setAnchors(({ text, bg }) => ({ text: bg, bg: text }));
    setActiveRole((current) => (current === "text" ? "bg" : current === "bg" ? "text" : null));
  }

  // A slider edit is the user setting the colour: it becomes the new anchor.
  function editColor(role: Role, color: Color) {
    setFadeColors(false);
    setColors((current) => ({ ...current, [role]: color }));
    setAnchors((current) => ({ ...current, [role]: color }));
  }

  // The active colour moves; with none active, the text colour does (CONTEXT.md: Level).
  // It moves from its anchor, not from wherever the last level click left it.
  function chooseLevel(level: number) {
    const role = activeRole ?? "text";
    setFadeColors(false);
    setColors((current) => {
      const start = { ...current, [role]: anchors[role] };
      return { ...current, [role]: reachLevel(start, role, level, contrastMethod) };
    });
  }

  function previousPhoto() {
    setPhotoIndex((index) => Math.max(0, index - 1));
  }

  // Steps forward. At the end of the stream (the buffer ran dry, or a fetch failed) it fetches
  // more itself and moves once they arrive.
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

  // Space: the first photo not yet shown moves to just after the current one, and shows.
  // So after walking back, Space still brings something new, and ← still returns here.
  async function jumpPhoto() {
    const at = photoIndex;
    const unseen = photos.findIndex((next, index) => index > at && !shown.current.has(next.id));
    if (unseen === -1) {
      const batch = await requestPhotos();
      if (batch.length === 0) return;
      setPhotos((current) => [...current.slice(0, at + 1), ...batch, ...current.slice(at + 1)]);
      setPhotoIndex(at + 1);
      return;
    }
    if (unseen !== photoIndex + 1) {
      setPhotos((current) => {
        const reordered = [...current];
        const [moved] = reordered.splice(unseen, 1);
        reordered.splice(at + 1, 0, moved);
        return reordered;
      });
    }
    setPhotoIndex(at + 1);
  }

  const textHex = toHex(colors.text);
  const bgHex = toHex(colors.bg);

  return (
    <main className="flex h-dvh flex-col">
      <Stage
        textHex={textHex}
        bgHex={bgHex}
        fadeColors={fadeColors}
        photo={photo}
        photoIndex={photoIndex}
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
