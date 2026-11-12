"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AccountLink } from "@/components/account/AccountLink";
import { useOpenSearch } from "@/components/ebk/Shell";
import { ACCOUNTS, LAB, NAV, PICKLAB, SITE } from "@/lib/site";
import { ThemeToggle } from "./ThemeToggle";

// The public site's bar: the wordmark, four sections, the theme switch. The Lab link exists only in a checkout that
// has a local workspace in app/lab (lib/site LAB).
const SOLID_LINE = "color-mix(in oklab, var(--foreground) 14%, var(--background))";

export function SiteNav() {
  const path = usePathname();
  const openSearch = useOpenSearch();
  // On a phone the sections row slides away while scrolling down and comes back on a scroll up, so the sticky bar
  // costs 48px of reading space instead of 100. Two rules keep it from flickering. It slides (a transform) and never
  // changes height, so hiding it can't move the page under the reader's finger and so set off another scroll. And it
  // only acts on a deliberate scroll, 48px in one direction, not on the small adjustments of someone reading.
  const [tucked, setTucked] = useState(false);
  useEffect(() => {
    let last = window.scrollY, run = 0;  // run: how far the page has moved in its current direction
    const on = () => {
      const y = window.scrollY, d = y - last;
      last = y;
      if (y < 120) { run = 0; setTucked(false); return; }
      run = Math.sign(d) === Math.sign(run) ? run + d : d;
      if (run > 48) setTucked(true);
      else if (run < -48) setTucked(false);
    };
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  useEffect(() => { setTucked(false); }, [path]);
  const items = (cls: string) => NAV.map((l) => {
    const active = [l.href, ...l.also].some((h) => path === h || path.startsWith(`${h}/`));
    return (
      <Link key={l.href} href={l.href} aria-current={active ? "page" : undefined}
        className={`${cls} ${active ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}>
        {l.label}
      </Link>
    );
  });
  return (
    <header className="pointer-events-none sticky top-0 z-40">
      <a href="#main" className="pl-label sr-only rounded-full bg-foreground px-4 py-2 text-background focus:not-sr-only focus:absolute focus:left-3 focus:top-14 focus:z-50">Skip to content</a>
      {/* solid on a phone (a blurred, see-through bar repaints on every scrolled frame there), frosted from `sm` up */}
      {/* the hairlines are opaque: the usual translucent --border lets text scrolling underneath show through as a faint strip */}
      <div className="pointer-events-auto relative z-10 border-b bg-background sm:bg-background/85 sm:backdrop-blur" style={{ borderColor: SOLID_LINE }}>
      <nav aria-label="Main" className="mx-auto flex h-12 max-w-7xl items-center gap-2 px-3 sm:gap-6 sm:px-4">
        <Link href="/" aria-label={SITE.name} className="pl-display shrink-0 text-xl leading-none tracking-wide">
          <span className="hidden md:inline">Elite Ball <span className="text-[var(--hot)]">Knowledge</span></span>
          <span aria-hidden className="inline-flex h-7 items-center justify-center rounded-md bg-foreground px-1.5 text-sm text-background md:hidden">{SITE.short}</span>
        </Link>
        <div className="hidden min-w-0 flex-1 gap-1 sm:flex">{items("pl-label shrink-0 rounded-full px-3 py-1.5 text-[11px]")}</div>
        <span className="flex-1 sm:hidden" />
        <button type="button" onClick={openSearch} aria-label="Search teams, players and games" aria-keyshortcuts="Meta+K Control+K /"
          className="inline-flex h-10 min-w-10 shrink-0 items-center justify-center gap-2 rounded-full border px-2.5 text-muted-foreground hover:text-foreground sm:h-8">
          <Search className="size-3.5" /><span className="pl-label hidden text-[10px] lg:inline">Search</span>
          <kbd className="pl-label hidden rounded border px-1 py-0.5 text-[9px] lg:inline">⌘K</kbd>
        </button>
        {LAB && <Link href="/lab" className="pl-label hidden shrink-0 rounded-full border px-2.5 py-1.5 text-[10px] text-muted-foreground hover:text-foreground sm:inline-flex" title="Local workspace">Lab</Link>}
        {ACCOUNTS && <AccountLink />}
        <ThemeToggle />
      </nav>
      </div>
      {/* on a phone the sections get their own row, evenly spread, so none is cut off or needs a sideways scroll. It
          keeps its place in the layout whether shown or slid up behind the bar above it, and tucks 1px under the bar: at a
          fractional pixel ratio (2.625 on many Android phones) two edges meeting mid-pixel leave a seam that shows what's behind. */}
      <nav aria-label="Sections" onFocus={() => setTucked(false)}
        style={{ borderColor: SOLID_LINE }}
        className={`-mt-px border-b bg-background transition-[transform,opacity] duration-200 motion-reduce:transition-none sm:hidden ${tucked ? "-translate-y-full opacity-0" : "pointer-events-auto"}`}>
        <div className="flex justify-between gap-0.5 px-2 py-1.5">{items("pl-label flex min-h-10 flex-1 items-center justify-center rounded-full px-1 text-center text-[11px]")}</div>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="grid gap-2">
          <p className="pl-display text-3xl">{SITE.name}</p>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
            Every number here is computed from public box scores and play-by-play, before the game starts, and every finding is
            written by rule from those numbers. No tracking, no ads{ACCOUNTS ? ", and nothing to read needs an account" : ", no account"}. Analysis, not advice.
          </p>
        </div>
        <ul className="pl-label flex flex-wrap gap-x-5 text-[11px] text-muted-foreground [&_a]:inline-flex [&_a]:min-h-10 [&_a]:items-center">
          <li><Link href="/sources" className="hover:text-foreground">Sources and method</Link></li>
          <li><Link href="/models" className="hover:text-foreground">How the models work</Link></li>
          <li><Link href="/models#record" className="hover:text-foreground">How it has done</Link></li>
          {PICKLAB && <li><Link href="/picklab" className="hover:text-foreground">PickLab</Link></li>}
          {ACCOUNTS && <li><Link href="/pricing" className="hover:text-foreground">Plans</Link></li>}
          <li><Link href="/privacy" className="hover:text-foreground">Privacy</Link></li>
        </ul>
      </div>
    </footer>
  );
}
