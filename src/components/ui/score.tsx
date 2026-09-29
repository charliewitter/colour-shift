import { Button } from "@/components/ui/button";

// Grade + value, e.g. `AA 5.21:1` (CONTEXT.md: Score). Mixed case on purpose: it's data.
// Standard button states (muted, hover fill, pressed outline); white text while the levels are
// open instead of a selected box (user's Figma update).
export function Score({ children, open, onClick }: { children: string; open: boolean; onClick: () => void }) {
  return (
    <Button strong={open} aria-expanded={open} aria-live="polite" onClick={onClick}>
      {children}
    </Button>
  );
}
