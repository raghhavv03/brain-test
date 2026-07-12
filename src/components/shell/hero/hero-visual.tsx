"use client";

/*
 * HeroVisual — the landing-page product visual (Phase 4.2).
 *
 * Currently a PLACEHOLDER bottle: layered SVG with gradient shading, floated
 * and swayed by Framer Motion inside the --hero-glow radial. No WebGL by
 * decision (see docs/project-reference.md §8a) — the placeholder must not pay
 * a mobile-performance price for fake 3D.
 *
 * ── SWAP CONTRACT ──────────────────────────────────────────────────────────
 * When the real product model arrives from the agency, this file is the
 * entire migration surface. Either:
 *   (a) replace <PlaceholderBottle /> below with the real render (image,
 *       video poster, or new SVG) — nothing outside this file changes; or
 *   (b) add a lazy-loaded <HeroVisual3D> (e.g. next/dynamic, WebGL) exposing
 *       this same prop surface ({ className }), and swap the export.
 * Keep whichever path is chosen behind the same rules: static poster
 * fallback, prefers-reduced-motion respected, mobile budget is a hard gate.
 * ───────────────────────────────────────────────────────────────────────────
 *
 * Reduced motion: the bottle renders in its static pose (no float, no sway);
 * the glow is static in both modes.
 */

import { motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";

type HeroVisualProps = {
  className?: string;
};

export function HeroVisual({ className }: HeroVisualProps) {
  const reducedMotion = useReducedMotion();

  return (
    <div
      aria-hidden
      className={cn("relative flex items-center justify-center", className)}
    >
      <div className="absolute inset-0 bg-[image:var(--hero-glow)]" />
      {/* Outer div floats (y), inner div sways (rotate) on a longer period so
          the combined motion never visibly repeats in sync. */}
      <motion.div
        className="relative w-36 md:w-44"
        animate={reducedMotion ? undefined : { y: [0, -12, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      >
        <motion.div
          animate={reducedMotion ? undefined : { rotate: [-1.5, 1.5, -1.5] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        >
          <PlaceholderBottle />
        </motion.div>
      </motion.div>
    </div>
  );
}

function PlaceholderBottle() {
  return (
    <svg viewBox="0 0 240 460" className="h-auto w-full" role="presentation">
      <defs>
        {/* Cylinder shading: edges darker, center bright. */}
        <linearGradient id="bottle-body" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" style={{ stopColor: "var(--border)" }} />
          <stop offset="0.3" style={{ stopColor: "var(--card)" }} />
          <stop offset="0.6" style={{ stopColor: "var(--card)" }} />
          <stop offset="1" style={{ stopColor: "var(--border)" }} />
        </linearGradient>
        <linearGradient id="bottle-cap" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" style={{ stopColor: "var(--accent-foreground)" }} />
          <stop offset="0.5" style={{ stopColor: "var(--primary)" }} />
          <stop offset="1" style={{ stopColor: "var(--accent-foreground)" }} />
        </linearGradient>
        {/* Same radial-orb motif as the lab stimuli, calm expression. */}
        <radialGradient id="bottle-orb">
          <stop offset="0" style={{ stopColor: "var(--primary)", stopOpacity: 0.9 }} />
          <stop offset="0.7" style={{ stopColor: "var(--primary)", stopOpacity: 0.25 }} />
          <stop offset="1" style={{ stopColor: "var(--primary)", stopOpacity: 0 }} />
        </radialGradient>
      </defs>

      {/* Ground shadow */}
      <ellipse cx="120" cy="442" rx="72" ry="10" fill="var(--foreground)" opacity="0.07" />

      {/* Cap */}
      <rect x="78" y="18" width="84" height="52" rx="10" fill="url(#bottle-cap)" />
      {/* Neck */}
      <rect x="90" y="66" width="60" height="22" fill="url(#bottle-body)" />
      {/* Body */}
      <rect
        x="56"
        y="86"
        width="128"
        height="332"
        rx="26"
        fill="url(#bottle-body)"
        stroke="var(--border)"
        strokeWidth="1"
      />
      {/* Specular highlight strip */}
      <rect x="72" y="106" width="9" height="292" rx="4.5" fill="var(--background)" opacity="0.85" />

      {/* Label band */}
      <rect x="57" y="168" width="126" height="154" fill="var(--shell-tint)" />
      <rect x="57" y="168" width="126" height="2.5" fill="var(--primary)" opacity="0.55" />
      <rect x="57" y="319.5" width="126" height="2.5" fill="var(--primary)" opacity="0.55" />

      {/* Label content — orb motif + placeholder wordmark */}
      <circle cx="120" cy="216" r="22" fill="url(#bottle-orb)" />
      <text
        x="120"
        y="266"
        textAnchor="middle"
        fill="var(--primary)"
        fontFamily="var(--font-geist-mono)"
        fontSize="13"
        letterSpacing="1.5"
      >
        [PLACEHOLDER]
      </text>
      <text
        x="120"
        y="288"
        textAnchor="middle"
        fill="var(--muted-foreground)"
        fontFamily="var(--font-geist-mono)"
        fontSize="9"
        letterSpacing="2.5"
      >
        COGNITIVE FORMULA
      </text>
    </svg>
  );
}
