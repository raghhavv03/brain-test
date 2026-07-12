import Link from "next/link";

import { EnterLabButton } from "@/components/shell/enter-lab-button";
import { HeroVisual } from "@/components/shell/hero/hero-visual";
import { Section, SectionHeading } from "@/components/shell/section";
import { SiteFooter } from "@/components/shell/site-footer";
import { SiteHeader } from "@/components/shell/site-header";

const steps = [
  {
    title: "[PLACEHOLDER] Play five short games",
    body: "[PLACEHOLDER] One line on the game battery — quick, focused rounds, phone or desktop.",
  },
  {
    title: "[PLACEHOLDER] Get an honest score",
    body: "[PLACEHOLDER] One line on the honest scoring stance — no manufactured deficits.",
  },
  {
    title: "[PLACEHOLDER] See strength & growth",
    body: "[PLACEHOLDER] One line on the results screen — one genuine strength, one genuine growth area.",
  },
];

/* Game and domain names are structurally true (the built battery, §4);
   descriptions are placeholder copy. */
const domains = [
  {
    game: "Trigger",
    name: "Speed",
    body: "[PLACEHOLDER] Plain-language line on processing speed.",
  },
  {
    game: "Gatekeeper",
    name: "Impulse Control",
    body: "[PLACEHOLDER] Plain-language line on response inhibition.",
  },
  {
    game: "Echo",
    name: "Working Memory",
    body: "[PLACEHOLDER] Plain-language line on holding and updating information.",
  },
  {
    game: "Circuit",
    name: "Flexibility",
    body: "[PLACEHOLDER] Plain-language line on task switching.",
  },
  {
    game: "Lock-On",
    name: "Divided Attention",
    body: "[PLACEHOLDER] Plain-language line on tracking several things at once.",
  },
];

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        {/* Hero — text + placeholder bottle visual (swap contract lives in
            hero-visual.tsx). */}
        <Section className="pt-16 md:pt-24">
          <div className="grid items-center gap-12 md:grid-cols-[1fr_auto] md:gap-16">
            <div className="flex max-w-2xl flex-col gap-6">
              <p className="font-mono text-xs uppercase tracking-widest text-primary">
                Cognitive Performance
              </p>
              <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">
                [PLACEHOLDER] A short test. An honest score.
              </h1>
              <p className="max-w-prose text-base text-muted-foreground md:text-lg">
                [PLACEHOLDER] Two-sentence hero subcopy: what the five games
                measure and roughly how long the test takes. No efficacy
                claims.
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <EnterLabButton size="lg">Take the Brain Test</EnterLabButton>
                <Link
                  href="/science"
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  How it works →
                </Link>
              </div>
            </div>
            <HeroVisual className="min-h-[22rem] md:min-h-[30rem] md:w-[22rem]" />
          </div>
        </Section>

        {/* How it works — three calm steps, mono number markers. */}
        <Section tint>
          <SectionHeading
            overline="How it works"
            title="[PLACEHOLDER] Three steps, about ten minutes"
            lede="[PLACEHOLDER] One-sentence framing of the flow — plain language, no promises."
          />
          <ol className="mt-12 grid gap-8 md:grid-cols-3 md:gap-12">
            {steps.map((step, i) => (
              <li key={step.title} className="flex flex-col gap-3">
                <span className="font-mono text-sm text-primary">
                  0{i + 1}
                </span>
                <h3 className="text-lg font-semibold tracking-tight">
                  {step.title}
                </h3>
                <p className="max-w-prose text-sm text-muted-foreground">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </Section>

        {/* Five domains — the shell's calm expression of the game battery. */}
        <Section>
          <SectionHeading
            overline="What it measures"
            title="[PLACEHOLDER] Five domains, five short games"
            lede="[PLACEHOLDER] One sentence on why these five, in plain language."
          />
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {domains.map((domain) => (
              <div
                key={domain.name}
                className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-6"
              >
                <p className="font-mono text-[0.65rem] uppercase tracking-widest text-muted-foreground">
                  {domain.game}
                </p>
                <h3 className="text-base font-semibold tracking-tight">
                  {domain.name}
                </h3>
                <p className="text-sm text-muted-foreground">{domain.body}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Credibility band — neurosurgeon-founded framing. No invented
            credentials/institutions; anything unknown reads as an obvious
            placeholder (§8a). */}
        <Section tint>
          <div className="grid items-center gap-10 md:grid-cols-[auto_1fr] md:gap-16">
            <div className="flex aspect-square w-48 items-center justify-center rounded-2xl border border-border bg-card md:w-56">
              <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                [Placeholder] Portrait
              </p>
            </div>
            <div className="flex max-w-prose flex-col gap-3">
              <p className="font-mono text-xs uppercase tracking-widest text-primary">
                Founded by a neurosurgeon
              </p>
              <h2 className="text-2xl font-semibold tracking-tight md:text-4xl">
                [PLACEHOLDER] Founder headline
              </h2>
              <p className="text-base text-muted-foreground md:text-lg">
                [PLACEHOLDER] Two-sentence founder bio. Real name, real
                background only — pending founder sign-off.
              </p>
              <Link
                href="/about"
                className="text-sm text-primary transition-colors hover:text-accent-foreground"
              >
                About the founder →
              </Link>
            </div>
          </div>
        </Section>

        {/* Honesty teaser — the "honest, not rigged" stance, links to Science. */}
        <Section>
          <SectionHeading
            overline="Honest, not rigged"
            title="[PLACEHOLDER] The score you get is the score you earned"
            lede="[PLACEHOLDER] Two sentences previewing the honesty stance: no manufactured deficits, scores anchored to task structure, no percentiles until real norms exist."
          />
          <Link
            href="/science"
            className="mt-6 inline-block text-sm text-primary transition-colors hover:text-accent-foreground"
          >
            Read how scoring works →
          </Link>
        </Section>

        {/* Final CTA band. */}
        <Section tint>
          <div className="flex flex-col items-center gap-6 text-center">
            <SectionHeading
              align="center"
              overline="Ready when you are"
              title="[PLACEHOLDER] Ten minutes. Five games. One honest score."
            />
            <EnterLabButton size="lg">Take the Brain Test</EnterLabButton>
          </div>
        </Section>
      </main>
      <SiteFooter />
    </>
  );
}
