"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "lab:reduced-motion-override";
const OVERRIDE_EVENT = "lab:reduced-motion-override-changed";
const MEDIA_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeToSystemPreference(callback: () => void) {
  const mql = window.matchMedia(MEDIA_QUERY);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getSystemPreference(): boolean {
  return window.matchMedia(MEDIA_QUERY).matches;
}

function getSystemPreferenceServerSnapshot(): boolean {
  return false;
}

function subscribeToOverride(callback: () => void) {
  window.addEventListener(OVERRIDE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(OVERRIDE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function getOverride(): boolean | null {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === "on") return true;
  if (raw === "off") return false;
  return null;
}

function getOverrideServerSnapshot(): boolean | null {
  return null;
}

/**
 * Reduced-motion preference: defaults to the OS setting, overridable via
 * toggle() and persisted per-browser. Independent of the shell/lab theme.
 */
export function useMotionPreference(): [boolean, () => void] {
  const system = useSyncExternalStore(
    subscribeToSystemPreference,
    getSystemPreference,
    getSystemPreferenceServerSnapshot
  );
  const override = useSyncExternalStore(
    subscribeToOverride,
    getOverride,
    getOverrideServerSnapshot
  );

  const toggle = useCallback(() => {
    const current = override ?? system;
    window.localStorage.setItem(STORAGE_KEY, current ? "off" : "on");
    window.dispatchEvent(new Event(OVERRIDE_EVENT));
  }, [override, system]);

  return [override ?? system, toggle];
}
