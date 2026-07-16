import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import { Section, SectionHeading } from "@/components/shell/section";
import { SiteFooter } from "@/components/shell/site-footer";
import { SiteHeader } from "@/components/shell/site-header";

export const metadata: Metadata = {
  title: "Product — Cognitive Brain Test",
  description: "[PLACEHOLDER] The product page — pending brand input.",
};

/* §8a discipline: this page is pure structural placeholder. No product name,
   no ingredients, no efficacy claims, no pricing, no testimonials — every
   slot describes what belongs in it. The CTA is deliberately unwired: a later
   team points it at the agency-built product site (§5), so it must NOT be
   EnterLabButton (wrong destination) or a live link (no destination exists). */

const benefitSlots = [
  {
    title: "[PLACEHOLDER] Benefit slot one",
    body: "[PLACEHOLDER] One approved, non-medical benefit statement — pending brand and scientific-team input.",
  },
  {
    title: "[PLACEHOLDER] Benefit slot two",
    body: "[PLACEHOLDER] Second approved benefit statement slot. No efficacy claims to be drafted by the layout team.",
  },
  {
    title: "[PLACEHOLDER] Benefit slot three",
    body: "[PLACEHOLDER] Third approved benefit statement slot — same rules as above.",
  },
];

export default function ProductPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        {/* Hero */}
        <Section className="pt-16 md:pt-24">
          <div className="grid items-center gap-10 md:grid-cols-2 md:gap-16">
            <div className="flex max-w-xl flex-col gap-6">
              <p className="font-mono text-xs uppercase tracking-widest text-primary">
                The Product
              </p>
              <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
                [PLACEHOLDER] Product name & headline
              </h1>
              <p className="max-w-prose text-base text-muted-foreground md:text-lg">
                [PLACEHOLDER] One-sentence product framing — what it is and who
                it is for. Pending brand input.
              </p>
              <div className="flex flex-col items-start gap-2">
                <Button size="lg" disabled>
                  [PLACEHOLDER] Product CTA
                </Button>
                <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                  CTA unwired — links to agency site later
                </p>
              </div>
            </div>
            <div className="flex aspect-square items-center justify-center rounded-2xl border border-border bg-card">
              <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                [Placeholder] Product imagery
              </p>
            </div>
          </div>
        </Section>

        {/* Benefit slots */}
        <Section tint>
          <SectionHeading
            overline="What it does"
            title="[PLACEHOLDER] Benefits headline — pending brand input"
            lede="[PLACEHOLDER] One sentence framing the approved benefit statements below."
          />
          <div className="mt-12 grid gap-8 md:grid-cols-3 md:gap-12">
            {benefitSlots.map((slot) => (
              <div key={slot.title} className="flex max-w-prose flex-col gap-3">
                <h3 className="text-lg font-semibold tracking-tight">
                  {slot.title}
                </h3>
                <p className="text-sm text-muted-foreground md:text-base">
                  {slot.body}
                </p>
              </div>
            ))}
          </div>
        </Section>

        {/* Ingredients / formulation slot */}
        <Section>
          <div className="grid items-start gap-10 md:grid-cols-2 md:gap-16">
            <SectionHeading
              overline="What's inside"
              title="[PLACEHOLDER] Formulation headline"
              lede="[PLACEHOLDER] Ingredient list and formulation copy — pending brand and scientific-team input. Not to be drafted by the layout team."
            />
            <div className="flex min-h-48 items-center justify-center rounded-2xl border border-border bg-card">
              <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                [Placeholder] Ingredient panel
              </p>
            </div>
          </div>
        </Section>

        {/* CTA band */}
        <Section tint>
          <div className="flex flex-col items-center gap-6 text-center">
            <SectionHeading
              align="center"
              overline="Get it"
              title="[PLACEHOLDER] Closing CTA headline — pending brand input"
            />
            <div className="flex flex-col items-center gap-2">
              <Button size="lg" disabled>
                [PLACEHOLDER] Product CTA
              </Button>
              <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                CTA unwired — links to agency site later
              </p>
            </div>
          </div>
        </Section>
      </main>
      <SiteFooter />
    </>
  );
}
