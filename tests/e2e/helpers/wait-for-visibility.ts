import type { Page } from "@playwright/test";

/**
 * Polls a `[data-target]` element's inline `style.visibility` (the flag
 * every game's trial loop flips directly, not a CSS class) until it reaches
 * the given state, via requestAnimationFrame — matching how the app itself
 * paces onset. Shared by Trigger/Gatekeeper/Echo's helpers since all three
 * games use the same visibility-flip convention for their stimulus element.
 */
export async function waitForTargetVisibility(
  page: Page,
  state: "visible" | "hidden",
  timeoutMs: number
): Promise<void> {
  await page.locator("[data-target]").evaluate(
    (el, { state, timeoutMs }) =>
      new Promise<void>((resolve, reject) => {
        if (el.style.visibility === state) return resolve();
        const start = Date.now();
        const poll = () => {
          if (el.style.visibility === state) return resolve();
          if (Date.now() - start > timeoutMs)
            return reject(new Error(`Stimulus never became ${state}`));
          requestAnimationFrame(poll);
        };
        requestAnimationFrame(poll);
      }),
    { state, timeoutMs }
  );
}
