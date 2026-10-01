import Image from "next/image";
import { useEffect, useEffectEvent, useRef, type KeyboardEvent } from "react";

type DropdownProps<T extends string> = {
  /** What the menu picks, for screen readers ("Specimen font"). */
  label: string;
  options: readonly { id: T; label: string }[];
  value: T;
  open: boolean;
  onToggle: () => void;
  onChoose: (id: T) => void;
  onClose: () => void;
};

// Figma `font dropdown` + `font menu`: the chosen option's name and a chevron; the menu drops
// below it. Open/closed lives in the parent (Esc closes every panel there). Clicking outside
// closes it; ↑ ↓ move between options; choosing one, or Esc, returns focus to the trigger.
export function Dropdown<T extends string>({ label, options, value, open, onToggle, onChoose, onClose }: DropdownProps<T>) {
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const current = options.find((option) => option.id === value);

  const onPointerDown = useEffectEvent((event: PointerEvent) => {
    if (!root.current?.contains(event.target as Node)) onClose();
  });

  // While open: outside clicks close it, and the chosen option takes focus so ↑ ↓ start from there.
  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLElement>("[aria-checked=true]")?.focus();
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function onMenuKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      trigger.current?.focus();
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const items = Array.from(menu.current?.querySelectorAll<HTMLElement>("[role=menuitemradio]") ?? []);
    const at = items.indexOf(document.activeElement as HTMLElement);
    const step = event.key === "ArrowDown" ? 1 : -1;
    items[(at + step + items.length) % items.length]?.focus();
  }

  function choose(id: T) {
    onChoose(id);
    trigger.current?.focus();
  }

  return (
    <div ref={root} className="relative">
      <button
        ref={trigger}
        type="button"
        aria-label={`${label}: ${current?.label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={onToggle}
        className={[
          "flex items-center gap-1.5 rounded-[4px] bg-surface-control py-1.5 pr-1.5 pl-2 text-value uppercase transition",
          // 40px tall on mobile, for touch (Figma `layout=mobile`).
          "max-sm:py-3 max-sm:pr-3 max-sm:pl-4",
          "hover:bg-surface-raised active:scale-95 focus-visible:outline focus-visible:outline-focus",
        ].join(" ")}
      >
        {current?.label}
        <Image src="/icons/chevron-down.svg" alt="" width={16} height={16} />
      </button>
      {open && (
        <div
          ref={menu}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKeyDown}
          className={[
            "absolute top-full left-0 z-10 mt-[3px] flex w-[180px] flex-col overflow-clip rounded-[4px] border border-border bg-surface",
            // Opens with a fade and a small drop (style guide: panels open). @starting-style gives
            // the first frame's values, so a freshly mounted menu still transitions in.
            "transition starting:-translate-y-1 starting:opacity-0",
          ].join(" ")}
        >
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              role="menuitemradio"
              aria-checked={option.id === value}
              onClick={() => choose(option.id)}
              className={[
                "p-2 text-left uppercase transition hover:bg-surface-control",
                "focus-visible:outline focus-visible:-outline-offset-1 focus-visible:outline-focus",
                option.id === value ? "bg-surface-control text-value" : "text-muted",
              ].join(" ")}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
