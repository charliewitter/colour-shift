import type { ComponentProps } from "react";

type ButtonProps = ComponentProps<"button"> & {
  /** Icon-only buttons use Figma's `icon button` padding (8 × 6). */
  icon?: boolean;
  selected?: boolean;
};

// States from the style guide: default, hover, pressed (Figma `active`), selected, focus.
export function Button({ icon = false, selected = false, className = "", ...props }: ButtonProps) {
  return (
    <button
      type="button"
      className={[
        "flex items-center gap-2 rounded-[4px] transition",
        "hover:bg-surface-raised active:scale-95 active:bg-surface-raised active:outline active:outline-stroke",
        "focus-visible:outline focus-visible:outline-focus",
        icon ? "px-2 py-1.5" : "p-2",
        selected ? "bg-surface-raised text-strong outline outline-stroke" : "text-muted",
        className,
      ].join(" ")}
      {...props}
    />
  );
}
