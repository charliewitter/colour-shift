// 12px colour chip. `color` is state, so it's the one place an inline colour is fine.
export function Swatch({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className="size-3 shrink-0 rounded-[2px] border-[0.5px] border-swatch-edge transition-colors delay-(--colour-fade-delay) duration-(--colour-fade-duration)"
      style={{ backgroundColor: color }}
    />
  );
}
