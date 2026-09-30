"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Dock } from "@/components/dock";
import { SliderPanel } from "@/components/slider-panel";
import { Stage } from "@/components/stage";
import {
  exportMarkdown,
  fromHex,
  reachLevel,
  toHex,
  type Color,
  type ColorMode,
  type ContrastMethod,
  type Pair,
  type Role,
} from "@/lib/color-engine";
import { DEFAULT_FONT, type SpecimenFontId } from "@/lib/fonts";
import { copyText, downloadText } from "@/lib/export";
import { DEFAULT_METHOD, DEFAULT_TEXT, shareQuery, type SharedParams } from "@/lib/share";
import { extractPair, fetchPhoto, fetchRandomPhotos, preloadPhoto, trackDownload } from "@/lib/photos";
import type { Photo } from "@/types/photo";

// An empty dark panel (--cs-surface, text the same so "Aa" is invisible) until the first photo's pair fades in.
const START_COLORS: Pair = {
  text: fromHex("#1a1718"),
  bg: fromHex("#1a1718"),
};

// If the first photos can't load (e.g. the Unsplash key's hourly limit): muted text on the dark
// panel (--cs-text-muted on --cs-surface), so the app still works as a colour tool.
const FALLBACK_COLORS: Pair = {
  text: fromHex("#a39f9f"),
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
// `shared` is what a share link asked for (page.tsx reads it on the server), so the first render
// already shows it.
export function ColorShift({ shared }: { shared: SharedParams }) {
  const [sharedColors] = useState<Pair | null>(() =>
    shared.colors ? { text: fromHex(shared.colors.text), bg: fromHex(shared.colors.bg) } : null,
  );
  const [colors, setColors] = useState(sharedColors ?? START_COLORS);
  // Each colour as the user last set it (CONTEXT.md: Anchor colour). Levels work from these,
  // so repeated level clicks never compound gamut losses (docs/adr/0005).
  const [anchors, setAnchors] = useState(sharedColors ?? START_COLORS);
  const [activeRole, setActiveRole] = useState<Role | null>(null);
  const [colorMode, setColorMode] = useState<ColorMode>("hsb");
  const [contrastMethod, setContrastMethod] = useState<ContrastMethod>(shared.method ?? DEFAULT_METHOD);
  const [levelsOpen, setLevelsOpen] = useState(false);
  const [sampleText, setSampleText] = useState(shared.text ?? DEFAULT_TEXT);
  const [font, setFont] = useState<SpecimenFontId>(shared.font ?? DEFAULT_FONT);
  const [fontMenuOpen, setFontMenuOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  // The photo stream, in order, and which one is showing. ← walks back; the rest are loaded ahead.
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [photoIndex, setPhotoIndex] = useState(0);
  // Each photo's pair, extracted as soon as the photo arrives, so showing it is instant.
  // A shared photo's pair is the shared one (so ← back to it restores that), and isn't extracted.
  const [pairs, setPairs] = useState<Record<string, Pair>>(() =>
    shared.photoId && sharedColors ? { [shared.photoId]: sharedColors } : {},
  );
  // Which photo's pair the colours were last set from (null while the current one is still extracting).
  const [pairFor, setPairFor] = useState<string | null>(null);
  // True when the colours last came from a photo (they crossfade), false after a hand edit (instant).
  const [fadeColors, setFadeColors] = useState(false);
  // Shared colours survive the first photo's pair, whichever photo that turns out to be (the
  // shared one, or a random one if the shared photo couldn't load).
  const [keepSharedColors, setKeepSharedColors] = useState(sharedColors !== null);
  // The random stream waits for a shared photo, so it can go first.
  const [waitingForShared, setWaitingForShared] = useState(shared.photoId !== null);
  const loadingPhotos = useRef(false);
  const prepared = useRef(new Set<string>(shared.photoId && sharedColors ? [shared.photoId] : []));
  const shown = useRef(new Set<string>());
  const photo = photos[photoIndex] ?? null;
  const pair = photo ? pairs[photo.id] : undefined;
  const photosAhead = photos.length - 1 - photoIndex;

  // A new photo brings its own pair. It counts as the user's choice, so it sets the anchors too
  // (docs/adr/0005). Set during render rather than in an effect: React's pattern for state that
  // follows other state, and it lands in the same paint as the photo.
  if (photo && pair && pairFor !== photo.id) {
    setPairFor(photo.id);
    if (keepSharedColors) {
      setKeepSharedColors(false);
    } else {
      setFadeColors(true);
      setColors(pair);
      setAnchors(pair);
    }
  } else if (photo && !pair && pairFor !== null) {
    setPairFor(null);
  }

  // A batch of random photos: [] if the request failed, null if skipped because one is already
  // on its way. The guard also stops React's dev-mode double effect from spending two API calls.
  async function requestPhotos(): Promise<Photo[] | null> {
    if (loadingPhotos.current) return null;
    loadingPhotos.current = true;
    try {
      return await fetchRandomPhotos(PHOTO_BATCH);
    } catch (error) {
      // A warning, not an error: it's handled, and Next's dev overlay pops up for errors.
      console.warn(error);
      return [];
    } finally {
      loadingPhotos.current = false;
    }
  }

  // A share link's photo goes first. If it can't load, the stream just starts with random ones.
  // The ref guard stops dev mode's double effect from spending two API calls.
  const sharedRequested = useRef(false);
  useEffect(() => {
    if (!shared.photoId || sharedRequested.current) return;
    sharedRequested.current = true;
    fetchPhoto(shared.photoId).then((sharedPhoto) => {
      if (sharedPhoto) setPhotos((current) => [sharedPhoto, ...current]);
      setWaitingForShared(false);
    });
  }, [shared.photoId]);

  // Keeps PHOTOS_AHEAD photos loaded past the current one (this is also the first load).
  useEffect(() => {
    if (waitingForShared || photosAhead >= PHOTOS_AHEAD) return;
    requestPhotos().then((batch) => {
      if (batch?.length) setPhotos((current) => [...current, ...batch]);
      else if (batch) {
        // Failed. If nothing has set the colours yet, fade in the fallback pair.
        setFadeColors(true);
        setColors((current) => (current === START_COLORS ? FALLBACK_COLORS : current));
        setAnchors((current) => (current === START_COLORS ? FALLBACK_COLORS : current));
      }
    });
  }, [photosAhead, waitingForShared]);

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
      setFontMenuOpen(false);
      setExportOpen(false);
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
    if (!batch?.length) return;
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
      if (!batch?.length) return;
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

  // The link that reopens what's on screen (CONTEXT.md: Share link). Built on demand; the
  // address bar is never touched.
  function shareUrl(): string {
    const query = shareQuery({ photoId: photo?.id ?? null, colors, method: contrastMethod, font, text: sampleText });
    return `${window.location.origin}/?${query}`;
  }

  function downloadMarkdown() {
    const markdown = exportMarkdown({ colors, method: contrastMethod, shareUrl: shareUrl(), credit: photo });
    downloadText(`colour-shift-${toHex(colors.text).slice(1)}-${toHex(colors.bg).slice(1)}.md`, markdown);
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
        sampleText={sampleText}
        onSampleTextChange={setSampleText}
        font={font}
        fontMenuOpen={fontMenuOpen}
        onToggleFontMenu={() => setFontMenuOpen((open) => !open)}
        onChooseFont={(chosen) => {
          setFont(chosen);
          setFontMenuOpen(false);
        }}
        onCloseFontMenu={() => setFontMenuOpen(false)}
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
        exportOpen={exportOpen}
        onToggleExport={() => setExportOpen((open) => !open)}
        onCopyUrl={() => copyText(shareUrl())}
        onDownload={downloadMarkdown}
      />
    </main>
  );
}
