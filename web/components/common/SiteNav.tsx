"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LAB, NAV, SITE } from "@/lib/site";
import { ThemeToggle } from "./ThemeToggle";

// The public site's bar: the wordmark, four sections, the theme switch. The Lab link exists only in a checkout that
// has the private app (lib/site LAB); the public build never links to it.
export function SiteNav() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
      <nav aria-label="Main" className="mx-auto flex h-12 max-w-7xl items-center gap-2 px-3 sm:gap-6 sm:px-4">
        <Link href="/" aria-label={SITE.name} className="pl-display shrink-0 text-xl leading-none tracking-wide">
          <span className="hidden md:inline">Elite Ball <span className="text-[var(--hot)]">Knowledge</span></span>
          <span aria-hidden className="inline-flex h-7 items-center justify-center rounded-md bg-foreground px-1.5 text-sm text-background md:hidden">{SITE.short}</span>
        </Link>
        <div className="flex min-w-0 flex-1 gap-0.5 sm:gap-1">
          {NAV.map((l) => {
            const active = [l.href, ...l.also].some((h) => path === h || path.startsWith(`${h}/`));
            return (
              <Link key={l.href} href={l.href} aria-current={active ? "page" : undefined}
                className={`pl-label shrink-0 rounded-full px-2 py-1.5 text-[10px] sm:px-3 sm:text-[11px] ${active ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}>
                {l.label}
              </Link>
            );
          })}
        </div>
        {LAB && <Link href="/lab" className="pl-label hidden shrink-0 rounded-full border px-2.5 py-1.5 text-[10px] text-muted-foreground hover:text-foreground sm:inline-flex" title="The private research app (this machine only)">Lab</Link>}
        <ThemeToggle />
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
            written by rule from those numbers. No tracking, no ads, no account. Analysis, not advice.
          </p>
        </div>
        <ul className="pl-label flex flex-wrap gap-x-5 gap-y-2 text-[10px] text-muted-foreground">
          <li><Link href="/picklab/sources" className="hover:text-foreground">Sources and method</Link></li>
          <li><Link href="/models" className="hover:text-foreground">How the models work</Link></li>
          <li><Link href="/picklab" className="hover:text-foreground">PickLab</Link></li>
        </ul>
      </div>
    </footer>
  );
}
