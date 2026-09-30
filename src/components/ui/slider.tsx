// One channel slider (Figma `slider` + `grip`). A native range input, invisible, sits on
// top and does the work (drag, keyboard, screen readers); the track and grip underneath
// are just pictures of its value.
type SliderProps = {
  label: string;
  value: number;
  max: number;
  step: number;
  gradient: string;
  onChange: (value: number) => void;
  /** Pointer or key released: the channel readout starts fading. */
  onRelease: () => void;
};

export function Slider({ label, value, max, step, gradient, onChange, onRelease }: SliderProps) {
  const fraction = max > 0 ? Math.min(1, value / max) : 0;

  return (
    <div className="group relative h-3">
      <div
        // bg-origin-border: size the gradient to the whole track, border included. By default it's
        // sized inside the border and repeats under it, showing the opposite end's colour at each end.
        className="absolute inset-x-0 top-1/4 bottom-1/4 rounded-full border border-track-edge bg-origin-border"
        style={{ backgroundImage: gradient }}
      />
      {/* 24px hit area. Its centre travels 12px in from each end, like the native thumb. */}
      <div
        className="pointer-events-none absolute top-1/2 grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center"
        style={{ left: `calc(12px + (100% - 24px) * ${fraction})` }}
      >
        <span
          className={[
            "size-2 rounded-full border border-grip-edge bg-grip transition-all",
            "group-hover:size-6 group-hover:border-grip-glass-edge group-hover:bg-grip-glass group-hover:backdrop-blur-[3px]",
            "group-has-active:size-6 group-has-active:border-grip-glass-edge group-has-active:bg-grip-glass group-has-active:backdrop-blur-[3px]",
            "group-has-focus-visible:outline group-has-focus-visible:outline-focus",
          ].join(" ")}
        />
      </div>
      <input
        type="range"
        aria-label={label}
        min={0}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        onPointerUp={onRelease}
        onKeyUp={onRelease}
        className={[
          "absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent opacity-0",
          "[&::-webkit-slider-thumb]:size-6 [&::-webkit-slider-thumb]:appearance-none",
          "[&::-moz-range-thumb]:size-6",
        ].join(" ")}
      />
    </div>
  );
}
