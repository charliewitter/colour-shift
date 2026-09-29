// Colour panel beside photo panel (CONTEXT.md: Stage).
// The photo panel stays a placeholder until step 3.
export function Stage({ textColor, bgColor }: { textColor: string; bgColor: string }) {
  return (
    <section className="grid min-h-0 flex-1 grid-cols-2">
      <div
        className="flex items-center justify-center"
        style={{ backgroundColor: bgColor, color: textColor }}
      >
        <p className="text-8xl leading-[1.05] tracking-tight">Aa</p>
      </div>
      <div className="bg-surface-raised" />
    </section>
  );
}
