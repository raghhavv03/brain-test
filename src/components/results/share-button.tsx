"use client";

/**
 * "Share my score" — only ever rendered by the parent when headline.status
 * === "scored" (see ResultsView), since there's nothing honest to share
 * from an insufficient-data run.
 *
 * The PNG is pre-rendered on mount, not on click. navigator.share() must be
 * called with no meaningful async gap after the click, or some browsers
 * (notably iOS/desktop Safari) silently drop "user activation" and reject
 * the call — the SVG→canvas→PNG pipeline involves an image decode and a
 * canvas.toBlob() round trip, both async, so doing that work inside the
 * click handler is exactly the failure mode to avoid. Pre-rendering while
 * the user is still looking at their score removes the gap entirely: by
 * the time they tap Share, the Blob already exists and share() fires
 * synchronously within the click's call stack.
 */

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { DomainScores, Headline } from "@/lib/scoring/types";
import { buildShareCardSvg, SHARE_CARD_SIZE } from "./share-card";

type ScoredHeadline = Extract<Headline, { status: "scored" }>;

type RenderState =
  | { status: "rendering" }
  | { status: "ready"; blob: Blob; url: string }
  | { status: "failed" };

export function ShareButton({
  headline,
  domains,
}: {
  headline: ScoredHeadline;
  domains: DomainScores;
}) {
  const [state, setState] = useState<RenderState>({ status: "rendering" });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    renderPng(headline, domains)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setState({ status: "ready", blob, url: objectUrl });
      })
      .catch((err) => {
        console.error("Failed to render share card:", err);
        if (!cancelled) setState({ status: "failed" });
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // headline/domains come from one already-computed result; identity is
    // stable for the life of this screen, so this effect runs once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleShare() {
    if (state.status !== "ready") return;
    setBusy(true);
    setNotice(null);

    const file = new File([state.blob], "brain-score.png", { type: "image/png" });
    const canShareFiles =
      typeof navigator.share === "function" &&
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [file] });

    if (canShareFiles) {
      try {
        await navigator.share({
          files: [file],
          title: "My Brain Score",
          text: `I scored ${headline.score} (${headline.band}) on the [BRAND] Cognitive Performance Lab.`,
        });
      } catch (err) {
        // AbortError = the user closed the OS share sheet without picking
        // anything — not a failure, don't fall back or show a message.
        if ((err as DOMException)?.name !== "AbortError") {
          downloadImage(state.url);
          setNotice("Sharing wasn't available here, so the image downloaded instead.");
        }
      }
    } else {
      downloadImage(state.url);
      setNotice("Image downloaded — this browser doesn't support direct sharing here.");
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <Button
        size="lg"
        variant="secondary"
        onClick={handleShare}
        disabled={state.status !== "ready" || busy}
      >
        {state.status === "failed"
          ? "Image unavailable"
          : state.status === "rendering"
            ? "Preparing image…"
            : "Share my score"}
      </Button>
      {notice && <p className="text-xs text-muted-foreground">{notice}</p>}
    </div>
  );
}

function downloadImage(url: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = "brain-score.png";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function renderPng(headline: ScoredHeadline, domains: DomainScores): Promise<Blob> {
  const svg = buildShareCardSvg({ headline, domains });
  const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);
  try {
    const img = await loadImage(svgUrl);
    const canvas = document.createElement("canvas");
    canvas.width = SHARE_CARD_SIZE;
    canvas.height = SHARE_CARD_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable.");
    ctx.drawImage(img, 0, 0, SHARE_CARD_SIZE, SHARE_CARD_SIZE);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png")
    );
    if (!blob) throw new Error("Canvas serialization returned no blob.");
    return blob;
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load share-card SVG."));
    img.src = src;
  });
}
