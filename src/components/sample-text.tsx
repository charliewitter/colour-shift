import { useLayoutEffect, useRef, type CSSProperties } from "react";
import { MAX_TEXT_LENGTH as MAX_LENGTH } from "@/lib/share";

// Font size range for fitting (px). Starts at Figma's 96 and shrinks as the text grows.
const MAX_SIZE = 96;
const MIN_SIZE = 16;

type SampleTextProps = {
  text: string;
  fontFamily: string;
  /** The text colour, for the 20% selection tint. */
  textHex: string;
  onChange: (text: string) => void;
};

// The editable sample text (CONTEXT.md: Sample text). Plain-text contentEditable: it centres,
// wraps and grows on its own. React doesn't render its children, so typing never resets the
// caret; the DOM is the source while editing, and `text` is copied in only when it differs
// (e.g. a share link, step 5). Empty shows "Aa". Enter or Esc stops editing.
export function SampleText({ text, fontFamily, textHex, onChange }: SampleTextProps) {
  const box = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLParagraphElement>(null);

  // Before the fit below, so the first measurement sees the text.
  useLayoutEffect(() => {
    if (field.current && field.current.textContent !== text) field.current.textContent = text;
  }, [text]);

  // Shrink to fit: the largest size (binary search, whole px) at which the text fits the box.
  // Written straight to the DOM, before paint, so there's no flash of overflowing text.
  // Re-runs when the text, font or panel size changes, and when a web font finishes loading
  // (the fallback shown until then has different widths).
  useLayoutEffect(() => {
    const area = box.current;
    const el = field.current;
    if (!area || !el) return;

    function fits(size: number) {
      el!.style.fontSize = `${size}px`;
      return el!.scrollWidth <= area!.clientWidth && el!.offsetHeight <= area!.clientHeight;
    }

    function fit() {
      el!.style.overflowWrap = "normal";
      let low = MIN_SIZE;
      let high = MAX_SIZE;
      while (low < high) {
        const mid = Math.ceil((low + high) / 2);
        if (fits(mid)) low = mid;
        else high = mid - 1;
      }
      // Even the smallest size overflows (one very long word): let it break anywhere.
      if (!fits(low)) el!.style.overflowWrap = "anywhere";
    }

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(area);
    document.fonts.addEventListener("loadingdone", fit);
    return () => {
      observer.disconnect();
      document.fonts.removeEventListener("loadingdone", fit);
    };
  }, [text, fontFamily]);

  function onInput() {
    const el = field.current!;
    let value = el.textContent ?? "";
    // Deleting everything can leave a stray <br>, which would hide the "Aa" placeholder.
    if (value === "") el.replaceChildren();
    if (value.length > MAX_LENGTH) {
      // Over the limit (typing or pasting): trim and put the caret at the end.
      value = value.slice(0, MAX_LENGTH);
      el.textContent = value;
      window.getSelection()?.collapse(el, el.childNodes.length);
    }
    onChange(value);
  }

  return (
    // The fit is measured against this box, so its inset is the text's margin: 64px on desktop;
    // on mobile 24px at the sides and 56px top and bottom (clear of the font dropdown).
    <div ref={box} className="absolute inset-16 flex items-center justify-center max-sm:inset-x-6 max-sm:inset-y-14">
      <p
        ref={field}
        contentEditable="plaintext-only"
        suppressContentEditableWarning
        spellCheck={false}
        role="textbox"
        aria-label="Sample text"
        onInput={onInput}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === "Escape") {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
        className={[
          "max-w-full cursor-text text-center leading-[1.05] tracking-[-0.02em] outline-none select-text",
          // Fades on hover (to 50%, tunable in DialKit via stage.tsx) so it reads as editable;
          // back to full while editing.
          "transition-opacity hover:opacity-(--sample-hover-opacity,0.65) focus:opacity-100",
          "empty:before:content-['Aa']",
          "selection:bg-[color-mix(in_srgb,var(--sample-color)_20%,transparent)]",
        ].join(" ")}
        style={{ fontFamily, "--sample-color": textHex } as CSSProperties}
      />
    </div>
  );
}
