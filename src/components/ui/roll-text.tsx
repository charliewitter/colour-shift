import { useLayoutEffect, useRef, useState } from "react";

// Text that rolls when it changes (CONTEXT.md: Roll): the old value slides up and out while the
// new one comes up from below. Only single changes roll. While the value is changing fast (a
// slider drag), each change lands instantly so you can watch it live.
// Timing and distance come from CSS variables on <main> (DialKit "Text roll" in color-shift.tsx).
export function RollText({ children: text }: { children: string }) {
  const [current, setCurrent] = useState(text);
  const [leaving, setLeaving] = useState<string | null>(null);
  const box = useRef<HTMLSpanElement>(null);
  const lastChange = useRef(0);

  // New value: the shown one becomes the leaving layer. Set during render so both layers
  // appear in the same paint (same pattern as the photo panel).
  if (text !== current) {
    setLeaving(current);
    setCurrent(text);
  }

  // Fast or slow? Changes closer together than --roll-settle (ms) are "fast": data-fast turns the
  // animation off and hides the leaving layer. Runs before paint, so a fast change never flickers.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const now = performance.now();
    const settle = parseFloat(getComputedStyle(el).getPropertyValue("--roll-settle")) || 300;
    el.toggleAttribute("data-fast", now - lastChange.current < settle);
    lastChange.current = now;
  }, [current]);

  return (
    // One grid cell holds both layers; clipped so the roll stays inside the line. The characters
    // are aria-hidden (split up they'd be read letter by letter); the sr-only copy is what's read.
    // nowrap: the per-character boxes would otherwise let the line break between any two characters.
    // text-left: buttons centre text, and mid-roll the cell is as wide as the longer value.
    <span ref={box} className="group inline-grid overflow-clip text-left align-top whitespace-nowrap">
      <span className="sr-only">{current}</span>
      {leaving !== null && (
        <span
          key={`out-${leaving}`}
          aria-hidden
          className="col-start-1 row-start-1 group-data-fast:hidden"
          // Done when the last (most delayed) character has rolled out.
          onAnimationEnd={(event) => event.target === event.currentTarget.lastElementChild && setLeaving(null)}
        >
          <Characters text={leaving} animation="animate-roll-out" />
        </span>
      )}
      <span key={current} aria-hidden className="col-start-1 row-start-1">
        <Characters text={current} animation={leaving !== null ? "animate-roll-in group-data-fast:animate-none" : ""} />
      </span>
    </span>
  );
}

// One span per character, each starting --roll-stagger later than the one before: the wave.
function Characters({ text, animation }: { text: string; animation: string }) {
  return [...text].map((character, index) => (
    <span
      key={index}
      className={`inline-block whitespace-pre ${animation}`}
      style={{ animationDelay: `calc(var(--roll-stagger, 12ms) * ${index})` }}
    >
      {character}
    </span>
  ));
}
