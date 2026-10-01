import { Button } from "@/components/ui/button";
import { RollText } from "@/components/ui/roll-text";
import { Swatch } from "@/components/ui/swatch";

// Swatch + hex (CONTEXT.md: Colour picker). Selecting it makes that colour the active colour;
// the `active` look (Figma) is Button's selected state.
export function ColorPicker({
  hex,
  label,
  active,
  onClick,
}: {
  hex: string;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Button selected={active} aria-pressed={active} onClick={onClick}>
      <span className="sr-only">{label}</span>
      <Swatch color={hex} />
      <span className="w-[7ch] text-left uppercase">
        <RollText>{hex}</RollText>
      </span>
    </Button>
  );
}
