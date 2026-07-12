import Link from "next/link";

import { EnterLabButton } from "@/components/shell/enter-lab-button";
import { HeroVisual } from "@/components/shell/hero/hero-visual";
import { Section, SectionHeading } from "@/components/shell/section";
import { SiteFooter } from "@/components/shell/site-footer";
import { SiteHeader } from "@/components/shell/site-header";

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

        {/* Stub band — proves the Section/tint rhythm; real content in the
            next steps. */}
        <Section tint>
          <SectionHeading
            overline="How it works"
            title="[PLACEHOLDER] Section stub"
            lede="[PLACEHOLDER] The how-it-works steps, domain grid, and credibility band land here in the following build steps."
          />
        </Section>
      </main>
      <SiteFooter />
    </>
  );
}
