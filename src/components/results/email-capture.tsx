"use client";

/**
 * Email capture — writes { session_id, email } to `leads`. Client-side
 * format validation only (no server-side check beyond the DB's plain text
 * column); duplicate detection relies on leads.session_id's unique
 * constraint via saveLead's 23505 handling, not a pre-submit lookup.
 */

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { saveLead } from "@/lib/supabase/leads";
import { ensureSession } from "@/lib/supabase/session";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Status = "idle" | "submitting" | "success" | "duplicate" | "error";

export function EmailCapture() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [formatError, setFormatError] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!EMAIL_PATTERN.test(trimmed)) {
      setFormatError(true);
      return;
    }
    setFormatError(false);
    setStatus("submitting");
    try {
      const sessionId = await ensureSession();
      const result = await saveLead(sessionId, trimmed);
      setStatus(result === "created" ? "success" : "duplicate");
    } catch (err) {
      console.error("Failed to save lead:", err);
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <SectionShell>
        <p className="text-sm text-foreground">
          You&apos;re on the list — thanks.
        </p>
      </SectionShell>
    );
  }

  if (status === "duplicate") {
    return (
      <SectionShell>
        <p className="text-sm text-muted-foreground">
          This session already has an email on file.
        </p>
      </SectionShell>
    );
  }

  return (
    <SectionShell>
      <form
        onSubmit={handleSubmit}
        noValidate
        className="flex w-full flex-col items-center gap-2 sm:flex-row sm:justify-center"
      >
        {/* noValidate: type="email" is kept only for the mobile keyboard
            layout — the browser's native validation UI isn't theme-aware,
            so our own regex + message below is what actually runs. */}
        <input
          type="email"
          inputMode="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (formatError) setFormatError(false);
          }}
          placeholder="you@example.com"
          disabled={status === "submitting"}
          aria-invalid={formatError}
          aria-describedby={formatError ? "email-format-error" : undefined}
          className="w-full max-w-xs rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
        />
        <Button type="submit" disabled={status === "submitting"}>
          {status === "submitting" ? "Sending…" : "Get my full results"}
        </Button>
      </form>
      {formatError && (
        <p id="email-format-error" className="text-xs text-destructive">
          Enter a valid email address.
        </p>
      )}
      {status === "error" && (
        <p className="text-xs text-muted-foreground">
          Couldn&apos;t save that — check your connection and try again.
        </p>
      )}
      <p className="max-w-sm text-center text-xs text-muted-foreground">
        We&apos;ll only use this to send your results and occasional [BRAND]
        updates — no spam.
      </p>
    </SectionShell>
  );
}

function SectionShell({ children }: { children: React.ReactNode }) {
  return (
    <section
      className="flex w-full max-w-md flex-col items-center gap-2"
      aria-label="Email capture"
    >
      {children}
    </section>
  );
}
