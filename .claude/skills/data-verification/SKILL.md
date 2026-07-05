---
name: data-verification
description: Verify measurement validity and run tests before committing any game, scoring, or data change. Use after building or editing a task or the scoring engine, and before shipping. Checks the data, not just the screen.
---

# Data Verification & Testing

A cognitive game can look flawless on screen and record garbage. The screen lies; the saved data doesn't. Run these checks before every commit that touches a game, timing, or scoring.

## Core rule: check the data, not the screen

After building or editing a task, inspect the actual rows written to the Supabase `trials` table before trusting it.

## Per-game validity checks

- **All timed tasks:** `rt_ms` values are plausible (mostly ~200–500ms). No negatives, no near-zero, no absurd outliers. Trials where the tab lost focus have `discarded = true`.
- **Trigger:** foreperiod varies (not a fixed rhythm).
- **Gatekeeper:** go/no-go split is ~80/20; commission errors (responses on no-go) are recorded.
- **Echo:** inter-stimulus interval is steady; target rate ~30%; hits vs false alarms distinguished.
- **Circuit:** alternation enforced; wrong taps rejected and counted; completion time recorded.
- **Lock-On:** targets indistinguishable after marking; accuracy per round recorded; runs smoothly on a real mid-range phone.

## Scoring checks

- A deliberately strong run scores clearly higher than a deliberately sloppy run.
- **No percentiles or population comparisons** (no norm data yet — self-relative/descriptive only).
- A `results` row is written with sub-scores, headline score, and band label.

## Test setup for this project

- **Vitest** — unit-test the scoring engine: feed known raw-trial fixtures, assert expected sub-scores. Scoring logic is pure and deterministic, so it's cheap and high-value to test.
- **Playwright** — one end-to-end test that plays through the full sequence and asserts a results screen renders and a session's trials + results row exist.
- **Dev stats script** — a small script that prints per-game trial stats (mean RT, discard count, error rate) for quick eyeballing after a run.
- Don't over-invest in test infrastructure for v1 — these three are enough.

## Before committing

1. Feature runs, no console errors.
2. Data checks above pass.
3. Nothing else broke (click through other games/pages).
4. Real-phone check where relevant.
5. Only then `git commit` with a clear message.
