import { Swatch } from "@/components/ui/swatch";

// Swatch + hex (CONTEXT.md: Colour picker). Display only until step 2 makes it select the active colour.
export function ColorPicker({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-2 p-2">
      <span className="sr-only">{label}</span>
      <Swatch color={color} />
      <span className="w-[7ch] uppercase">{color}</span>
    </span>
  );
}
