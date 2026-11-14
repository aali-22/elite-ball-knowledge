"use client";

// The visitor's side of visit counting (lib/analytics.ts): a one-time notice with the way out, and the standing
// control. Both draw nothing in a build without a measurement id.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { ANALYTICS, choice, gpc, setAnalytics, subscribe } from "@/lib/analytics";
import { isLab } from "@/lib/site";

/** "ask": not asked yet (counting is on); "gpc": off because the browser sends Global Privacy Control. */
type State = "ask" | "on" | "off" | "gpc";
const read = (): State => (gpc() ? "gpc" : choice() ?? "ask");
/** The visitor's choice; null on the server and until the browser has taken the page over. */
const useChoice = () => useSyncExternalStore<State | null>(subscribe, read, () => null);

/** Shown once, to a visitor who hasn't chosen: what is counted, what isn't, and the switch. Drawn only in the browser
 *  and fixed to the bottom edge, so the page the server sent never moves; the page gains the bar's height at its end,
 *  so the bar never sits on the footer's last lines. */
export function AnalyticsNotice() {
  const path = usePathname();
  const state = useChoice();
  const bar = useRef<HTMLDivElement>(null);
  const show = ANALYTICS && state === "ask" && !isLab(path) && !path.startsWith('/account/workspace');
  useEffect(() => {
    const el = bar.current;
    if (!show || !el) return;
    const fit = () => { document.body.style.paddingBottom = `${el.offsetHeight}px`; };
    fit();
    const watch = new ResizeObserver(fit);
    watch.observe(el);
    return () => { watch.disconnect(); document.body.style.paddingBottom = ""; };
  }, [show]);
  if (!show) return null;
  return (
    <div ref={bar} role="region" aria-label="Analytics notice" data-analytics-notice
      className="fixed inset-x-0 bottom-0 z-50 border-t bg-background" style={{ borderColor: "color-mix(in oklab, var(--foreground) 22%, var(--background))" }}>
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-6">
        <p className="min-w-0 flex-1 text-xs leading-relaxed text-muted-foreground">
          This site uses Google Analytics to count visits and see which pages get used. No ads, no advertising cookies, nothing sold.{" "}
          <Link href="/privacy#analytics" className="whitespace-nowrap text-foreground underline underline-offset-4">What it collects</Link>
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={() => setAnalytics(false)} className="pl-label min-h-10 rounded-full border px-4 text-[10px] text-muted-foreground hover:text-foreground">Turn analytics off</button>
          <button type="button" onClick={() => setAnalytics(true)} className="pl-label min-h-10 rounded-full bg-foreground px-5 text-[10px] text-background">OK</button>
        </div>
      </div>
    </div>
  );
}

/** The standing control: "Analytics: on · turn off" / "Analytics: off · turn on". A browser that sends Global Privacy
 *  Control is off and stays off: the site doesn't offer to override the browser's own setting. */
export function AnalyticsChoice({ className = "" }: { className?: string }) {
  const state = useChoice();
  if (!ANALYTICS) return null;
  const on = state === null || state === "ask" || state === "on";
  return (
    <span className={`inline-flex min-h-10 flex-wrap items-center gap-x-1.5 ${className}`} data-analytics-choice={state ?? ""}>
      <span>Analytics: {on ? "on" : "off"}</span>
      {state === "gpc" ? <span>(your browser sends Global Privacy Control)</span> : (
        <><span aria-hidden>·</span>
          <button type="button" onClick={() => setAnalytics(!on)} className="min-h-10 underline decoration-[var(--hot)] decoration-2 underline-offset-4 [letter-spacing:inherit] [text-transform:inherit] hover:text-foreground">
            {on ? "turn off" : "turn on"}
          </button></>
      )}
    </span>
  );
}
