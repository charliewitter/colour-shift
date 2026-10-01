import type { ReactNode } from "react";

// Opens and closes a panel (style guide: panels open with 0fr → 1fr, a fade and a small vertical
// slide). The content stays mounted while closed, so it can animate both ways: the grid row
// animates from 0 to the content's own height, which plain `height: auto` can't do. Closed
// content is `inert`: no tabbing into it, and screen readers skip it.
export function Reveal({ open, children, className = "" }: { open: boolean; children: ReactNode; className?: string }) {
  return (
    <div
      inert={!open}
      className={[
        "grid transition-[grid-template-rows,opacity]",
        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        className,
      ].join(" ")}
    >
      <div className={`min-h-0 overflow-hidden transition-transform ${open ? "translate-y-0" : "translate-y-1"}`}>
        {children}
      </div>
    </div>
  );
}
