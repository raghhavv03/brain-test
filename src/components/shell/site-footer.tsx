import Link from "next/link";

const footerLinks = [
  { href: "/science", label: "The Science" },
  { href: "/about", label: "About" },
  { href: "/product", label: "Product" },
  { href: "/privacy", label: "Privacy & Disclaimer" },
  { href: "/test", label: "Take the Brain Test" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-12">
        <div className="flex flex-col justify-between gap-8 sm:flex-row">
          <div className="flex max-w-xs flex-col gap-2">
            <p className="text-sm font-semibold tracking-tight">
              [PLACEHOLDER] Brand
            </p>
            <p className="text-sm text-muted-foreground">
              [PLACEHOLDER] One-line brand descriptor lives here.
            </p>
          </div>
          <nav className="flex flex-col gap-2 sm:items-end">
            {footerLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex flex-col gap-2 border-t border-border/60 pt-6">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Not a medical test
          </p>
          <p className="max-w-prose text-xs text-muted-foreground">
            [PLACEHOLDER] This is a cognitive performance exercise, not a
            medical or diagnostic instrument. Final disclaimer wording pending
            legal/scientific review.
          </p>
        </div>
      </div>
    </footer>
  );
}
