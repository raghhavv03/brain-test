type ReducedMotionToggleProps = {
  reducedMotion: boolean;
  onToggle: () => void;
};

export function ReducedMotionToggle({
  reducedMotion,
  onToggle,
}: ReducedMotionToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={reducedMotion}
      className="rounded-full border border-border px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
    >
      Motion: {reducedMotion ? "Reduced" : "Full"}
    </button>
  );
}
