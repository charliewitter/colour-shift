// Tabs in a recessed `well` track (Figma `contrast method switch`). The selected tab
// is raised with strong text and, unlike Button, has no outline.
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex gap-0.5 rounded-[4px] bg-well p-0.5">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={[
              "rounded-[4px] px-3 py-[5px] transition hover:bg-surface-raised",
              "focus-visible:outline focus-visible:outline-focus",
              selected ? "bg-surface-raised text-strong" : "text-muted",
            ].join(" ")}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
