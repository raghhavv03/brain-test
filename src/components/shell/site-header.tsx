import Link from "next/link";

import { EnterLabButton } from "@/components/shell/enter-lab-button";

const navLinks = [
  { href: "/science", label: "The Science" },
  { href: "/about", label: "About" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          [PLACEHOLDER] Brand
        </Link>
        <nav className="flex items-center gap-6">
          {/* Text links collapse below sm; the footer carries the full nav.
              Full responsive pass comes later in Phase 4. */}
          <div className="hidden items-center gap-6 sm:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </div>
          <EnterLabButton size="sm">Take the Brain Test</EnterLabButton>
        </nav>
      </div>
    </header>
  );
}
