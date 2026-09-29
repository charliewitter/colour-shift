import { Button } from "@/components/ui/button";

// One button per level (CONTEXT.md: Level). Unselected levels sit in a `well` fill;
// the passing level is raised with the selected look (Figma `levels`).
export function Levels({
  levels,
  passing,
  format,
  onSelect,
}: {
  levels: readonly number[];
  passing: number | null;
  format: (level: number) => string;
  onSelect: (level: number) => void;
}) {
  return (
    <div role="group" aria-label="Levels" className="flex items-center gap-1">
      {levels.map((level) => {
        const selected = level === passing;
        return (
          <Button
            key={level}
            selected={selected}
            aria-pressed={selected}
            onClick={() => onSelect(level)}
            className={selected ? "" : "bg-well"}
          >
            {format(level)}
          </Button>
        );
      })}
    </div>
  );
}
