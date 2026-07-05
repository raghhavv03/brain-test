// Purely presentational — renders whatever stimulusLabel the timing engine
// already set ("GO" / "NO-GO" / ""). No transition on reveal: the stimulus
// must appear instantly on the same frame as onset, same as Trigger's target.

type GateSignalProps = {
  ref: React.Ref<HTMLDivElement>;
  stimulusLabel: string;
};

export function GateSignal({ ref, stimulusLabel }: GateSignalProps) {
  const isGo = stimulusLabel === "GO";
  const isNoGo = stimulusLabel === "NO-GO";

  return (
    <div
      ref={ref}
      data-target
      className="relative flex h-36 w-36 items-center justify-center rounded-full border border-border"
      style={{
        visibility: "hidden",
        transition: "none",
        borderColor: isNoGo
          ? "var(--destructive)"
          : isGo
            ? "var(--primary)"
            : undefined,
        background: isGo
          ? "radial-gradient(circle at 35% 35%, #93c5fd, var(--primary) 55%, #1d4ed8 100%)"
          : isNoGo
            ? "radial-gradient(circle at 35% 35%, #fca5a5, var(--destructive) 55%, #7f1d1d 100%)"
            : "transparent",
        boxShadow: isGo
          ? "0 0 70px 14px color-mix(in srgb, var(--primary) 55%, transparent)"
          : isNoGo
            ? "0 0 70px 14px color-mix(in srgb, var(--destructive) 55%, transparent)"
            : "none",
      }}
    >
      {isGo && (
        <svg viewBox="0 0 24 24" className="h-14 w-14" fill="none">
          <path
            d="M6 15 L12 8 L18 15"
            stroke="var(--primary-foreground)"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
      {isNoGo && (
        <svg viewBox="0 0 24 24" className="h-14 w-14" fill="none">
          <path
            d="M12 3 L21 19 H3 Z"
            stroke="var(--primary-foreground)"
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
          <line
            x1={12}
            y1={9.5}
            x2={12}
            y2={13.5}
            stroke="var(--primary-foreground)"
            strokeWidth={2.5}
            strokeLinecap="round"
          />
          <circle cx={12} cy={16.3} r={1.1} fill="var(--primary-foreground)" />
        </svg>
      )}
      {(isGo || isNoGo) && (
        <span
          className="absolute -bottom-7 font-mono text-[10px] uppercase tracking-widest"
          style={{ color: isGo ? "var(--primary)" : "var(--destructive)" }}
        >
          {isGo ? "Authorize" : "Hostile"}
        </span>
      )}
    </div>
  );
}
