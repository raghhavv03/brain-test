/**
 * Universal measurement engine — timing-critical primitives shared by all
 * cognitive tasks (science rules):
 * - All measurement timestamps come from performance.now().
 * - Stimulus onset is marked inside a requestAnimationFrame callback, in the
 *   same callback that makes the stimulus visible.
 * - Responses are captured on pointerdown/keydown; the timestamp is taken on
 *   the first line of the handler.
 * - setTimeout is allowed for scheduling only (foreperiods, pauses), never as
 *   a timestamp source.
 */

export function randomForeperiod(minMs: number, maxMs: number): number {
  return minMs + Math.random() * (maxMs - minMs);
}

/** Scheduling only — never use for measurement. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Reveals the stimulus element and captures onset time inside the same
 * requestAnimationFrame callback, so the timestamp and the visual change
 * belong to the same frame. The element must already be in the DOM.
 */
export function showStimulusAtNextFrame(el: HTMLElement): Promise<number> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      el.style.visibility = "visible";
      resolve(performance.now());
    });
  });
}

export type CapturedResponse = {
  timestamp: number;
  type: "pointerdown" | "keydown";
  key?: string;
};

/**
 * Resolves with the next pointerdown or keydown on window. Attach before the
 * foreperiod starts so premature responses (false starts) are captured too.
 */
export function awaitResponse(): {
  promise: Promise<CapturedResponse>;
  cancel: () => void;
} {
  let settled = false;
  let cleanup = () => {};

  const promise = new Promise<CapturedResponse>((resolve) => {
    const finish = (response: CapturedResponse) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(response);
    };

    const onPointerDown = () => {
      const timestamp = performance.now();
      finish({ timestamp, type: "pointerdown" });
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const timestamp = performance.now();
      if (e.repeat) return;
      finish({ timestamp, type: "keydown", key: e.key });
    };

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    cleanup = () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  });

  return {
    promise,
    cancel: () => {
      settled = true;
      cleanup();
    },
  };
}

export type VisibilityWatcher = {
  /** True if the tab was hidden at any point since the last reset(). */
  readonly compromised: boolean;
  reset: () => void;
  destroy: () => void;
};

/**
 * Tracks tab visibility via the Page Visibility API. Call reset() at the start
 * of each trial; if `compromised` is true when the trial ends, save it with
 * discarded = true (still save it — raw data is always kept).
 */
export function createVisibilityWatcher(): VisibilityWatcher {
  let compromised = document.hidden;
  const onChange = () => {
    if (document.hidden) compromised = true;
  };
  document.addEventListener("visibilitychange", onChange);
  return {
    get compromised() {
      return compromised;
    },
    reset() {
      compromised = document.hidden;
    },
    destroy() {
      document.removeEventListener("visibilitychange", onChange);
    },
  };
}
