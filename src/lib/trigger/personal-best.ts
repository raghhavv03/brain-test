const STORAGE_KEY = "trigger:personal-best-ms";
const CHANGE_EVENT = "trigger:personal-best-changed";

/** Per-browser display value only — not part of the scientific record. */
export function getPersonalBest(): number | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export function getPersonalBestServerSnapshot(): number | null {
  return null;
}

/** For useSyncExternalStore — notifies on same-tab updates (custom event) and cross-tab ones (storage). */
export function subscribePersonalBest(callback: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

/** Stores rtMs as the new best if it beats the current one; returns the resulting best. */
export function recordIfBest(rtMs: number): number {
  const current = getPersonalBest();
  if (current === null || rtMs < current) {
    window.localStorage.setItem(STORAGE_KEY, String(rtMs));
    window.dispatchEvent(new Event(CHANGE_EVENT));
    return rtMs;
  }
  return current;
}
