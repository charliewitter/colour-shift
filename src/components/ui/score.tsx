// Grade + value, e.g. `AA 5.21:1` (CONTEXT.md: Score). Mixed case on purpose: it's data.
// Becomes a button that opens the levels in step 2.
export function Score({ children }: { children: string }) {
  return (
    <span aria-live="polite" className="p-2">
      {children}
    </span>
  );
}
