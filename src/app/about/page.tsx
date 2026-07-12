import type { Metadata } from "next";

import { EnterLabButton } from "@/components/shell/enter-lab-button";
import { Section, SectionHeading } from "@/components/shell/section";
import { SiteFooter } from "@/components/shell/site-footer";
import { SiteHeader } from "@/components/shell/site-header";

export const metadata: Metadata = {
  title: "About — Cognitive Brain Test",
  description:
    "[PLACEHOLDER] The founder story and the mission behind the test.",
};

/* §8a discipline, strictest on this page: the one established fact is that
   the founder is a practicing neurosurgeon. Every placeholder below DESCRIBES
   the slot it holds ("pending founder input") rather than simulating a
   personal narrative — a fabricated-sounding story would read as true even
   while tagged. */

export default function AboutPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        {/* Hero */}
        <Section className="pt-16 md:pt-24">
          <div className="flex max-w-2xl flex-col gap-6">
            <p className="font-mono text-xs uppercase tracking-widest text-primary">
              About
            </p>
            <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
              [PLACEHOLDER] About headline — pending founder input
            </h1>
            <p className="max-w-prose text-base text-muted-foreground md:text-lg">
              [PLACEHOLDER] One-sentence framing of the brand and the person
              behind it.
            </p>
          </div>
        </Section>

        {/* Founder story */}
        <Section tint>
          <div className="grid items-start gap-10 md:grid-cols-[auto_1fr] md:gap-16">
            <div className="flex aspect-square w-48 items-center justify-center rounded-2xl border border-border bg-card md:w-64">
              <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                [Placeholder] Portrait
              </p>
            </div>
            <div className="flex max-w-prose flex-col gap-4">
              <p className="font-mono text-xs uppercase tracking-widest text-primary">
                Founded by a practicing neurosurgeon
              </p>
              <h2 className="text-2xl font-semibold tracking-tight md:text-4xl">
                [PLACEHOLDER] Founder name & headline
              </h2>
              <p className="text-base text-muted-foreground">
                [PLACEHOLDER] Founder bio paragraph — real name, real
                background, real credentials only. Pending founder input; not
                to be drafted by the layout team.
              </p>
              <p className="text-base text-muted-foreground">
                [PLACEHOLDER] Second bio paragraph slot — the founder&apos;s
                own account of the path from clinical practice to this
                product. Pending founder input.
              </p>
            </div>
          </div>
        </Section>

        {/* Mission — the founder's personal "why", not a restatement of the
            science stance (that lives on /science). */}
        <Section>
          <SectionHeading
            overline="Why this exists"
            title="[PLACEHOLDER] Mission headline — pending founder input"
            lede="[PLACEHOLDER] One sentence connecting the founder's motivation to the product."
          />
          <div className="mt-12 grid gap-8 md:grid-cols-2 md:gap-12">
            <div className="flex max-w-prose flex-col gap-3">
              <h3 className="text-lg font-semibold tracking-tight">
                [PLACEHOLDER] The personal motivation
              </h3>
              <p className="text-sm text-muted-foreground md:text-base">
                [PLACEHOLDER] The founder&apos;s own words on why he built a
                cognitive test rather than just a supplement — pending founder
                input. Not to be ghost-written.
              </p>
            </div>
            <div className="flex max-w-prose flex-col gap-3">
              <h3 className="text-lg font-semibold tracking-tight">
                [PLACEHOLDER] Why honesty is the strategy
              </h3>
              <p className="text-sm text-muted-foreground md:text-base">
                [PLACEHOLDER] The brand-level case for an honest score — a
                test rigged to sell would spend the credibility the brand
                rests on. Final wording pending founder input.
              </p>
            </div>
          </div>
        </Section>

        {/* CTA band */}
        <Section tint>
          <div className="flex flex-col items-center gap-6 text-center">
            <SectionHeading
              align="center"
              overline="Try it yourself"
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
