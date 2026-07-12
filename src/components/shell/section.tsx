import { cn } from "@/lib/utils";

/*
 * Shell layout primitives (Phase 4.2). Every shell page (Home, Science,
 * About, and later Product/Privacy/Blog) builds its sections from these so
 * the rhythm — py-20/28 bands, max-w-6xl container, overline+heading+lede —
 * stays identical across pages.
 */

type SectionProps = {
  id?: string;
  /** Faint blue wash band — alternate with plain background for page rhythm. */
  tint?: boolean;
  className?: string;
  children: React.ReactNode;
};

export function Section({ id, tint = false, className, children }: SectionProps) {
  return (
    <section id={id} className={cn("py-20 md:py-28", tint && "bg-shell-tint", className)}>
      <div className="mx-auto w-full max-w-6xl px-6">{children}</div>
    </section>
  );
}

type SectionHeadingProps = {
  /** Short mono uppercase label above the title, e.g. "THE SCIENCE". */
  overline: string;
  title: string;
  lede?: string;
  align?: "left" | "center";
  className?: string;
};

export function SectionHeading({
  overline,
  title,
  lede,
  align = "left",
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "flex max-w-prose flex-col gap-3",
        align === "center" && "mx-auto items-center text-center",
        className,
      )}
    >
      <p className="font-mono text-xs uppercase tracking-widest text-primary">
        {overline}
      </p>
      <h2 className="text-2xl font-semibold tracking-tight md:text-4xl">{title}</h2>
      {lede ? (
        <p className="text-base text-muted-foreground md:text-lg">{lede}</p>
      ) : null}
    </div>
  );
}
