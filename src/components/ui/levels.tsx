import { Button } from "@/components/ui/button";

// One button per level (CONTEXT.md: Level). Unselected levels sit in a `well` fill;
// the passing level is raised with the selected look (Figma `levels`). `stretch` (mobile) shares
// the full width equally between 40px-tall buttons.
export function Levels({
  levels,
  passing,
  format,
  onSelect,
  stretch = false,
  className = "",
}: {
  levels: readonly number[];
  passing: number | null;
  format: (level: number) => string;
  onSelect: (level: number) => void;
  stretch?: boolean;
  className?: string;
}) {
  return (
    <div role="group" aria-label="Levels" className={`flex items-center gap-1 ${stretch ? "w-full" : ""} ${className}`}>
      {levels.map((level) => {
        const selected = level === passing;
        return (
          <Button
            key={level}
            selected={selected}
            aria-pressed={selected}
            onClick={() => onSelect(level)}
            className={`${selected ? "" : "bg-well"} ${stretch ? "h-10 flex-1 justify-center" : ""}`}
          >
            {format(level)}
          </Button>
        );
      })}
    </div>
  );
}
