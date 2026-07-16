import type { Metadata } from "next";

import { Section, SectionHeading } from "@/components/shell/section";
import { SiteFooter } from "@/components/shell/site-footer";
import { SiteHeader } from "@/components/shell/site-header";

export const metadata: Metadata = {
  title: "Privacy & Disclaimer — Cognitive Brain Test",
  description:
    "What this test is (and is not), and exactly what data it collects.",
};

/*
 * Unlike the other shell pages, most of this page is REAL copy, not
 * structural placeholder — the app needs a working "not a medical test"
 * disclaimer and an accurate data-collection description now.
 *
 * Two distinct review tags are in play (deliberately different strings so
 * the two teams' tag-searches don't collide):
 *   [PLACEHOLDER]                — marketing/copy team, same as other pages.
 *   [PLACEHOLDER - LEGAL REVIEW] — questions only the legal team can answer
 *                                  (jurisdiction, retention, entity name,
 *                                  processor agreements, user-rights process).
 *                                  Values under this tag are reasoned drafts,
 *                                  NOT decisions.
 *
 * The "What we collect" section is written strictly from what the app
 * actually stores (docs/project-reference.md §9) — do not add generic
 * privacy-policy boilerplate about data we don't collect.
 */

const collected = [
  {
    what: "An anonymous session",
    detail:
      "When you start the test, we create an anonymous session — a random identifier with no account, no name, and no password. It exists so your own results can be shown back to you. Database access rules restrict every session to reading and writing only its own data.",
  },
  {
    what: "Your responses during the games",
    detail:
      "For every round of every game we record what was shown, how you responded, your response time in milliseconds, whether the response was correct, and whether the round had to be discarded (for example, because the browser tab lost focus). This per-round record is what your score is computed from — keeping it raw is what keeps the score honest.",
  },
  {
    what: "Your computed results",
    detail:
      "Your domain scores, headline score, and score band are stored against the same anonymous session so your results page works.",
  },
  {
    what: "Your email — only if you choose to give it",
    detail:
      "The results screen offers an optional email field. If you submit it, your email is stored with your session; if you don't, no email or other contact detail is collected anywhere in the test.",
  },
  {
    what: "Basic technical context",
    detail:
      "Your browser's user-agent string is stored with the session, used to understand device-specific measurement issues (for example, timing behaviour that differs between phone and desktop browsers).",
  },
];

const legalItems = [
  {
    heading: "Who is responsible for this data",
    tag: true,
    body: "[PLACEHOLDER - LEGAL REVIEW] The legal entity operating this site — company name, registered address, and role (data controller) — pending legal team. Draft structure assumes a single controlling entity; if the brand and the test operate under different entities, this section must name both.",
  },
  {
    heading: "Where the data is processed",
    tag: true,
    body: "[PLACEHOLDER - LEGAL REVIEW] The test runs on Vercel (site hosting) and Supabase (database and anonymous sign-in) — factually the two services in use today. A product analytics service (PostHog) is planned but not yet live. Legal team to confirm: processor agreements, hosting regions, and whether the final processor list requires additional disclosures (e.g. international-transfer language).",
  },
  {
    heading: "How long we keep it",
    tag: true,
    body: "[PLACEHOLDER - LEGAL REVIEW] Retention period pending legal team. Reasoned draft: anonymous session and per-round data retained for [N months] for score integrity and measurement-quality analysis, then deleted or irreversibly anonymised; emails retained until the person unsubscribes or asks for deletion. These numbers are placeholders, not commitments.",
  },
  {
    heading: "Your rights and how to reach us",
    tag: true,
    body: "[PLACEHOLDER - LEGAL REVIEW] Access, correction, and deletion process pending legal team. Reasoned draft: email [contact address] with the request; because sessions are anonymous, deletion of game data may require the email you submitted (if any) or the device you used, to locate the session. Exact rights list depends on the governing jurisdiction below.",
  },
  {
    heading: "Governing law",
    tag: true,
    body: "[PLACEHOLDER - LEGAL REVIEW] Jurisdiction and governing law pending legal team. Not drafted here — naming a jurisdiction before legal review would be an invented legal claim.",
  },
];

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        {/* Hero */}
        <Section className="pt-16 md:pt-24">
          <div className="flex max-w-2xl flex-col gap-6">
            <p className="font-mono text-xs uppercase tracking-widest text-primary">
              Privacy &amp; Disclaimer
            </p>
            <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
              What this test is, what it isn&apos;t, and what it collects
            </h1>
            <p className="max-w-prose text-base text-muted-foreground md:text-lg">
              Short version: this is not a medical test, your session is
              anonymous, and the only personal detail we ever hold is an email
              you choose to give us.
            </p>
          </div>
        </Section>

        {/* Disclaimer — real, final-intent copy. */}
        <Section tint id="disclaimer">
          <SectionHeading
            overline="Not a medical test"
            title="This is a performance exercise, not a diagnosis"
          />
          <div className="mt-8 flex max-w-prose flex-col gap-4 text-base text-muted-foreground">
            <p>
              The Brain Test measures how you perform on five short cognitive
              games, right now, on your device. It is built on task designs
              used in cognitive research, and it is honest about what it
              finds — but it is not a medical or diagnostic instrument, and
              your score is not a clinical assessment of any kind.
            </p>
            <p>
              A score — high or low — cannot tell you whether anything is
              medically right or wrong. Performance on games like these varies
              with sleep, stress, caffeine, practice, the device in your hand,
              and the room you&apos;re sitting in. If you have any concern
              about your memory, attention, or cognitive health, speak to a
              doctor; no result on this site is a substitute for that.
            </p>
            <p>
              We will never present your score with more precision than it
              has, and we will never use it to alarm you into buying anything.
            </p>
          </div>
        </Section>

        {/* Data collection — real copy, strictly what the app stores. */}
        <Section id="data">
          <SectionHeading
            overline="Your data"
            title="Exactly what we collect, and why"
            lede="No account is created and no name is asked for. Everything below is tied only to an anonymous session."
          />
          <div className="mt-12 flex max-w-prose flex-col gap-8">
            {collected.map((item) => (
              <div key={item.what} className="flex flex-col gap-2">
                <h3 className="text-lg font-semibold tracking-tight">
                  {item.what}
                </h3>
                <p className="text-sm text-muted-foreground md:text-base">
                  {item.detail}
                </p>
              </div>
            ))}
          </div>
        </Section>

        {/* Legal scaffolding — every item pending legal review. */}
        <Section tint id="legal">
          <SectionHeading
            overline="The legal part"
            title="Details pending legal review"
            lede="Everything in this section is a drafted structure awaiting the legal team — the tagged values are placeholders, not commitments."
          />
          <div className="mt-12 grid gap-8 md:grid-cols-2 md:gap-12">
            {legalItems.map((item) => (
              <div key={item.heading} className="flex max-w-prose flex-col gap-2">
                <h3 className="text-lg font-semibold tracking-tight">
                  {item.heading}
                </h3>
                <p className="text-sm text-muted-foreground md:text-base">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </Section>
      </main>
      <SiteFooter />
    </>
  );
}
