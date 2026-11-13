"use client";

// One control that shares a page: the device's own share sheet where there is one (a phone), else the link is copied
// and the button says so for a moment. The link is whatever it is given: a game's address, or a game's address with
// ?f=<finding id>, whose preview then shows that finding (app/(ebk)/game/[id]/page.tsx).
import { Check, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { track, type Events } from "@/lib/analytics";

type Props = {
  /** A path on this site ("/game/nba-…?f=…") or a whole address. */
  url: string;
  title: string;
  text?: string;
  /** What is being shared, and its sport: all that is counted (lib/analytics `share`). */
  kind?: Events["share"]["kind"];
  sport?: string;
  label?: string;
  className?: string;
};

/** A link to one finding of a game: the game's address plus the finding's id. */
export const findingUrl = (gamePath: string, findingId: string) => `${gamePath}?f=${encodeURIComponent(findingId)}`;

export function ShareButton({ url, title, text, kind = "page", sport, label = "Share", className = "" }: Props) {
  const [done, setDone] = useState<"copied" | "failed" | null>(null);
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setDone(null), 2000);
    return () => clearTimeout(t);
  }, [done]);
  const share = async () => {
    const href = new URL(url, window.location.origin).toString();
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ url: href, title, text });
        track("share", { kind, method: "native", sport });
      } catch { /* the visitor closed the sheet: nothing was shared, nothing is counted */ }
      return;
    }
    try {
      await navigator.clipboard.writeText(href);
      setDone("copied");
      track("share", { kind, method: "copy", sport });
    } catch {
      setDone("failed");  // no clipboard access (an old browser, a blocked permission): say so rather than pretend
    }
  };
  return (
    <button type="button" onClick={share} data-share={kind}
      className={`pl-label inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-[10px] text-muted-foreground hover:text-foreground ${className}`}>
      {done === "copied" ? <Check className="size-3.5" aria-hidden /> : <Share2 className="size-3.5" aria-hidden />}
      <span aria-live="polite">{done === "copied" ? "Link copied" : done === "failed" ? "Copy the address bar" : label}</span>
    </button>
  );
}
