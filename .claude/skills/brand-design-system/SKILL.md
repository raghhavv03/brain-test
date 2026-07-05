---
name: brand-design-system
description: Apply this project's visual identity, layout, and animation style to any UI work — pages, components, game skins, transitions. Use whenever building or restyling anything visual. Enforces "calm shell, lively lab" and consistent design tokens.
---

# Brand Design System

The product sells a cognitive-performance nutraceutical whose credibility rests on a neurosurgeon's name. The UI must read as **trustworthy and modern**, interactive enough to engage, but never gimmicky.

## Core principle: calm shell, lively lab

- **Calm shell** — marketing/credibility pages (Home, Science, About, Privacy): restrained, lots of whitespace, light background, minimal motion. These build trust; they must not feel like a game.
- **Lively lab** — the game zone: dark "performance lab" theme, animated, satisfying feedback. Concentrate all interactivity here.

When building anything, first decide: shell or lab? Style accordingly.

## Design tokens (never hardcode values)

Use the tokens defined in the Tailwind config. Do not hardcode colors, spacing, or fonts inline.

- **Color:** off-white background, near-black text, one accent `[ACCENT]` (a clinical blue or vital green). Dark theme reserved for the lab.
- **Typography:** one primary sans `[FONT]` (Inter default; Geist/Satoshi for more character). Max two typefaces.
- **Spacing:** generous, on a consistent scale. Whitespace is the main lever for a premium feel.

*(Fill `[ACCENT]` and `[FONT]` once chosen; until then use sensible defaults and keep them tokenized so a single edit changes everything.)*

## Components

- Build on **shadcn/ui**; restyle to the tokens. Don't hand-roll buttons, dialogs, progress bars, inputs.
- Keep tap targets large; design **mobile-first**, then expand to desktop.

## Animation (Framer Motion)

- Shell: subtle only — gentle fades/slides on load and navigation.
- Lab: lively — micro-feedback on every correct response, satisfying stage transitions, a between-game performance-meter moment.
- Motion should **reward or guide**, never distract or delay a response the game is timing.
- Always respect `prefers-reduced-motion` and offer a reduced-motion toggle.
- For the game canvas with many moving objects (Lock-On), prefer HTML Canvas over animating many DOM nodes, for frame-rate reasons.

## Results / score screen tone

Honest and calm. Show a genuine strength and a genuine growth area. **No alarmism, no manufactured deficits, no medical claims.** The trust this preserves is the entire marketing strategy.

## Quality bar

- Nothing should look templated or default. Intentional spacing, type scale, and one confident accent beat a busy palette.
- Consistency across pages matters more than any single flourish.
