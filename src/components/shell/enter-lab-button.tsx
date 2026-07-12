"use client";

/*
 * EnterLabButton — the designed shell→lab entry moment (Phase 4.2, §8a).
 *
 * Renders the "Take the Brain Test" CTA. On click it plays a ~400ms radial
 * sweep — lab-dark irises out from the click point over the light shell —
 * then navigates to /test. The sweep lives entirely on the shell side as an
 * exit transition; /test itself is untouched.
 *
 * Reduced motion: the click handler leaves the <Link> alone, so navigation
 * is native and instant — no sweep code runs at all.
 *
 * The overlay carries the `.lab` class so its background IS the lab
 * background token — it stays correct if the lab palette ever changes. It is
 * portaled to <body> because the sticky header's backdrop-blur creates a
 * containing block that would trap a position:fixed child.
 */

import { useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";

import { Button } from "@/components/ui/button";

const SWEEP_SECONDS = 0.4;

type EnterLabButtonProps = {
  size?: "sm" | "lg" | "default";
  className?: string;
  children: React.ReactNode;
};

export function EnterLabButton({
  size = "default",
  className,
  children,
}: EnterLabButtonProps) {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const [sweepOrigin, setSweepOrigin] = useState<{ x: number; y: number } | null>(
    null,
  );

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (reducedMotion) return; // native Link navigation, no sweep
    event.preventDefault();
    if (sweepOrigin) return; // sweep already running
    // Keyboard activation reports clientX/Y as 0 — fall back to link center.
    const rect = event.currentTarget.getBoundingClientRect();
    setSweepOrigin({
      x: event.clientX || rect.left + rect.width / 2,
      y: event.clientY || rect.top + rect.height / 2,
    });
  };

  return (
    <>
      <Button
        size={size}
        className={className}
        nativeButton={false}
        render={<Link href="/test" onClick={handleClick} />}
      >
        {children}
      </Button>
      {sweepOrigin
        ? createPortal(
            <LabSweep origin={sweepOrigin} onDone={() => router.push("/test")} />,
            document.body,
          )
        : null}
    </>
  );
}

function LabSweep({
  origin,
  onDone,
}: {
  origin: { x: number; y: number };
  onDone: () => void;
}) {
  // Radius that guarantees full viewport coverage from the click point.
  const radius = Math.hypot(
    Math.max(origin.x, window.innerWidth - origin.x),
    Math.max(origin.y, window.innerHeight - origin.y),
  );

  return (
    <motion.div
      aria-hidden
      className="lab fixed inset-0 z-[100] bg-background"
      initial={{ clipPath: `circle(0px at ${origin.x}px ${origin.y}px)` }}
      animate={{ clipPath: `circle(${radius}px at ${origin.x}px ${origin.y}px)` }}
      transition={{ duration: SWEEP_SECONDS, ease: [0.4, 0, 0.2, 1] }}
      onAnimationComplete={onDone}
    />
  );
}
