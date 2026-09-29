// Colour panel beside photo panel (CONTEXT.md: Stage).
// Step 0 placeholders: grey tokens stand in for the pair and the photo.
export function Stage() {
  return (
    <section className="grid min-h-0 flex-1 grid-cols-2">
      <div className="flex items-center justify-center bg-surface">
        <p className="text-8xl leading-[1.05] tracking-tight text-strong">Aa</p>
      </div>
      <div className="bg-surface-raised" />
    </section>
  );
}
