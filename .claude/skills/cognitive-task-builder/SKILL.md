---
name: cognitive-task-builder
description: Build, skin, or modify any cognitive game in this project (Trigger, Gatekeeper, Echo, Circuit, Lock-On) and its timing or trial data. Use whenever creating a task, changing measurement logic, saving trials, or skinning a game. Enforces measurement validity — the scientific correctness the whole product depends on.
---

# Cognitive Task Builder

This project is a cognitive self-assessment. Its credibility depends on the scores being **real measurements**, not decorations. Code that runs but mismeasures is the worst failure mode here. Follow these rules on every task.

## Prime Directive: skin freely, never bend the skeleton

- **Skin (free to change):** theme, colors, art, sound, animation, copy, difficulty ramp visuals.
- **Skeleton (never change without the user explicitly asking):** timing method, trial ratios, intervals, randomization, task logic, what gets recorded.

If a visual change would require altering the skeleton, stop and flag it instead of doing it.

## Universal Measurement Rules (all games)

1. Time responses with `performance.now()`, and mark stimulus onset on `requestAnimationFrame`. **Never** use `Date.now()` or `setTimeout` timestamps for measurement.
2. Capture the response on `pointerdown`/`keydown`, timestamped the same way; `rt_ms` = response − onset.
3. Use the **Page Visibility API** to detect if the tab loses focus during a trial; mark that trial `discarded = true`.
4. **Always save every raw trial** (not just aggregates) to the Supabase `trials` table: `session_id, game, trial_index, stimulus, response, rt_ms, correct, discarded`.
5. Never present or imply medical-grade precision. This is not a medical test.

## Reuse the shared engine

A universal measurement module exists (built in Phase 1). When building games 2–5, **reuse it** — do not regenerate timing/recording logic. Point edits at the existing engine.

## Fixed structure per game (the skeleton)

- **Trigger (reaction time):** random foreperiod 1–3s before each signal (never a predictable rhythm); ~20–30 trials; record RT + errors.
- **Gatekeeper (go/no-go):** ~80% go / ~20% no-go, randomized; ~40 trials; primary measure = commission errors (responding on no-go).
- **Echo (2-back):** steady **fixed** inter-stimulus interval (e.g. 2500ms); ~24 items, ~30% targets; classify each as hit / false alarm / miss / correct rejection.
- **Circuit (trail-making B):** alternate number/letter (1-A-2-B-…); wrong taps rejected, counted, and must be corrected before advancing (no skipping); record completion time + errors.
- **Lock-On (MOT):** highlight K targets, then make them visually identical to distractors; move all with unpredictable, non-looping velocities; user selects K; record accuracy; escalate K until a miss.

## Workflow for any new/edited game

1. Build the **logic first, unstyled**. Explain the approach before coding.
2. **Verify the data in Supabase** (see the data-verification skill) before styling.
3. **Then** skin it — and when skinning, do not touch timing or data code.
4. One step per change. Never combine logic + styling + a new game in one pass.

## Red flags — stop and ask

- Any request to make a game "easier to pass" or tune results toward low scores.
- Any change to intervals, ratios, or randomization framed as a UX improvement.
- Removing raw-trial saving to "simplify."

