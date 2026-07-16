"use client";

/*
 * ExitLabLink — the results→shell exit moment (Phase 4.2, §8a), the inverse
 * of EnterLabButton. On click it plays a ~400ms radial sweep — shell-light
 * irises out from the click point over the dark lab — then navigates to the
 * given href. Results-screen content holds static underneath; nothing about
 * results state is touched.
 *
 * Reduced motion: the click handler leaves the <Link> alone, so navigation
 * is native and instant — no sweep code runs at all.
 *
 * Thin wrapper over the shared ZoneSweep primitive (src/components/shell/
 * zone-sweep.tsx), theme="shell" — see EnterLabButton for the inverse
 * direction.
 */

import { useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useReducedMotion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { resolveSweepOrigin, ZoneSweep, type SweepOrigin } from "./zone-sweep";

type ExitLabLinkProps = {
  href: string;
  className?: string;
  children: React.ReactNode;
};

export function ExitLabLink({ href, className, children }: ExitLabLinkProps) {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const [sweepOrigin, setSweepOrigin] = useState<SweepOrigin | null>(null);

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (reducedMotion) return; // native Link navigation, no sweep
    event.preventDefault();
    if (sweepOrigin) return; // sweep already running
    setSweepOrigin(resolveSweepOrigin(event));
  };

  return (
    <>
      <Button
        variant="ghost"
        className={className}
        nativeButton={false}
        render={<Link href={href} onClick={handleClick} />}
      >
        {children}
      </Button>
      {sweepOrigin
        ? createPortal(
            <ZoneSweep
              origin={sweepOrigin}
              theme="shell"
              onDone={() => router.push(href)}
            />,
            document.body,
          )
        : null}
    </>
  );
}
