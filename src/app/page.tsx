import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Section, SectionHeading } from "@/components/shell/section";
import { SiteFooter } from "@/components/shell/site-footer";
import { SiteHeader } from "@/components/shell/site-header";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        {/* Hero — text block only in this step; the bottle visual and the
            shell→lab CTA sweep land in the next step. */}
        <Section className="pt-24 md:pt-32">
          <div className="flex max-w-2xl flex-col gap-6">
            <p className="font-mono text-xs uppercase tracking-widest text-primary">
              Cognitive Performance
            </p>
            <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">
              [PLACEHOLDER] A short test. An honest score.
            </h1>
            <p className="max-w-prose text-base text-muted-foreground md:text-lg">
              [PLACEHOLDER] Two-sentence hero subcopy: what the five games
              measure and roughly how long the test takes. No efficacy claims.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <Button size="lg" nativeButton={false} render={<Link href="/test" />}>
                Take the Brain Test
              </Button>
              <Link
                href="/science"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                How it works →
              </Link>
            </div>
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
