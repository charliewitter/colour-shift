import { Dock } from "@/components/dock";
import { Stage } from "@/components/stage";

// The whole app. From step 1, all state lives here (APP-SPEC: one top-level component).
export function ColorShift() {
  return (
    <main className="flex h-dvh flex-col">
      <Stage />
      <Dock />
    </main>
  );
}
