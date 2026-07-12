import type { Metadata } from "next";
import Link from "next/link";

import { EnterLabButton } from "@/components/shell/enter-lab-button";
import { Section, SectionHeading } from "@/components/shell/section";
import { SiteFooter } from "@/components/shell/site-footer";
import { SiteHeader } from "@/components/shell/site-header";

export const metadata: Metadata = {
  title: "The Science — Cognitive Brain Test",
  description:
    "[PLACEHOLDER] How the test measures five cognitive domains, and how scoring works — honestly.",
};

/* Domain + paradigm-family names are structurally true statements about the
   built battery (docs/project-reference.md §4). Elaborations are placeholder. */
const measures = [
  {
    domain: "Speed",
    paradigm: "Reaction-time task",
    body: "[PLACEHOLDER] One plain-language line on what a reaction-time task involves.",
  },
  {
    domain: "Impulse Control",
    paradigm: "Go/no-go task",
    body: "[PLACEHOLDER] One plain-language line on responding to frequent signals and withholding on rare ones.",
  },
  {
    domain: "Working Memory",
    paradigm: "N-back task",
    body: "[PLACEHOLDER] One plain-language line on matching the current item against one shown earlier.",
  },
  {
    domain: "Flexibility",
    paradigm: "Trail-making task",
    body: "[PLACEHOLDER] One plain-language line on switching between two sequences under time.",
  },
  {
    domain: "Divided Attention",
    paradigm: "Multiple-object tracking",
    body: "[PLACEHOLDER] One plain-language line on tracking several moving targets at once.",
  },
];

/* Approved verbatim (Phase 4.2 step 4 review) — do not edit without a fresh
   review pass. Each statement mirrors documented engine behavior (§9a). */
const scoringBlocks = [
  {
    title: "Anchored to the task itself.",
    body: "Your score in each domain is computed against fixed reference points in that task's own difficulty structure — how fast a valid response can realistically be, how hard a two-back match is to hold. This is called criterion-anchored scoring. Every anchor is a reviewable, documented decision about the task — not a claim about how you compare to anyone else.",
  },
  {
    title: "Why you won't see percentiles.",
    body: "A percentile is a statement about where you stand among everyone who took the test. Making that statement honestly requires population data this test does not yet have. So there are no percentiles here — not hidden, not estimated, just not claimed. If real norms are built from enough genuine results later, that can change.",
  },
  {
    title: "What a higher score means.",
    body: "A higher score means your measured performance moved against the task's own anchors: faster valid responses, fewer false alarms, a longer tracking span. It is not a statement about your brain versus other people's, and one ten-minute session is a snapshot — attention, sleep, and practice all move it.",
  },
  {
    title: "When we can't measure, we say so.",
    body: "The five domains count equally in your headline score, because we have no evidence that would honestly justify weighting one above another. And if a game doesn't produce enough clean data — say, the tab lost focus mid-round — that domain reports “not enough clean data” instead of an invented number. No headline score appears at all unless at least three of the five domains were properly measured.",
  },
];

export default function SciencePage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        {/* Hero — credibility-toned, no bottle visual. */}
        <Section className="pt-16 md:pt-24">
          <div className="flex max-w-2xl flex-col gap-6">
            <p className="font-mono text-xs uppercase tracking-widest text-primary">
              The Science
            </p>
            <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
              [PLACEHOLDER] Built on established task designs, scored without
              pretending
            </h1>
            <p className="max-w-prose text-base text-muted-foreground md:text-lg">
              [PLACEHOLDER] One- or two-sentence framing: the games are skins
              on long-studied cognitive task structures; the scoring tells you
              only what it can honestly support.
            </p>
          </div>
        </Section>

        {/* What the test measures — five domains, real paradigm families. */}
        <Section tint>
          <SectionHeading
            overline="What it measures"
            title="[PLACEHOLDER] Five domains, five established task designs"
            lede="[PLACEHOLDER] One sentence: each game keeps its task structure fixed; only the visuals are ours."
          />
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {measures.map((m) => (
              <div
                key={m.domain}
                className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-6"
              >
                <p className="font-mono text-[0.65rem] uppercase tracking-widest text-primary">
                  {m.paradigm}
                </p>
                <h3 className="text-base font-semibold tracking-tight">
                  {m.domain}
                </h3>
                <p className="text-sm text-muted-foreground">{m.body}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* How scoring works — copy reviewed and approved verbatim (Phase 4.2
            step 4). Grounded in the scoring engine's actual behavior
            (docs/project-reference.md §9a); wording still awaits the
            scientific team's final sign-off, hence the tag line below. */}
        <Section>
          <SectionHeading
            overline="How scoring works"
            title="Scored against the task, not against a crowd"
            lede="Most brain-test scores quietly imply a comparison to other people. Ours doesn't — here is exactly what your number means."
          />
          <div className="mt-12 grid gap-8 md:grid-cols-2 md:gap-12">
            {scoringBlocks.map((block) => (
              <div key={block.title} className="flex max-w-prose flex-col gap-3">
                <h3 className="text-lg font-semibold tracking-tight">
                  {block.title}
                </h3>
                <p className="text-sm text-muted-foreground md:text-base">
                  {block.body}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-12 font-mono text-xs uppercase tracking-widest text-muted-foreground">
            [PLACEHOLDER] Wording pending scientific-team sign-off
          </p>
        </Section>

        {/* What this is not — unmissable, not fine print. */}
        <Section tint>
          <div className="rounded-3xl border-2 border-border bg-card p-8 md:p-12">
            <div className="flex max-w-prose flex-col gap-4">
              <p className="font-mono text-xs uppercase tracking-widest text-destructive">
                What this is not
              </p>
              <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
                Not a medical test. Not a diagnosis.
              </h2>
              <p className="text-base text-muted-foreground">
                [PLACEHOLDER] Plain statement pending legal wording: this is a
                performance exercise; it cannot detect, rule out, or monitor
                any medical condition, and it is not a substitute for
                professional evaluation.
              </p>
            </div>
          </div>
        </Section>

        {/* Founder cross-link. */}
        <Section>
          <div className="flex max-w-prose flex-col gap-3">
            <p className="font-mono text-xs uppercase tracking-widest text-primary">
              Who built this
            </p>
            <h2 className="text-2xl font-semibold tracking-tight md:text-4xl">
              [PLACEHOLDER] Founded by a practicing neurosurgeon
            </h2>
            <p className="text-base text-muted-foreground md:text-lg">
              [PLACEHOLDER] One sentence pointing to the founder story.
            </p>
            <Link
              href="/about"
              className="text-sm text-primary transition-colors hover:text-accent-foreground"
            >
              About the founder →
            </Link>
          </div>
        </Section>

        {/* CTA band. */}
        <Section tint>
          <div className="flex flex-col items-center gap-6 text-center">
            <SectionHeading
              align="center"
              overline="See for yourself"
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
