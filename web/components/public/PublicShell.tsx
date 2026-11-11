"use client";

// The public view's own frame: its own top bar (none of the private sections link from here), an age check, and the
// responsible-gambling footer on every page. The private TopNav hides itself under /public.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AGE_KEY, HELP, MIN_AGE } from "@/lib/publicConfig";

const LINKS = [
  { href: "/picklab", label: "Picks", exact: true },
  { href: "/picklab/experts", label: "Experts" },
  { href: "/picklab/strategies", label: "Our record" },
  { href: "/picklab/sources", label: "Sources" },
];

function AgeGate({ onOk }: { onOk: () => void }) {
  return (
    <div role="dialog" aria-modal aria-labelledby="age-title" className="fixed inset-0 z-50 grid place-items-center bg-background/95 p-4">
      <div className="grid max-w-sm gap-4 rounded-xl border bg-card p-6 text-center">
        <h2 id="age-title" className="pl-display text-4xl">{MIN_AGE}+ only</h2>
        <p className="text-sm text-muted-foreground">
          This site talks about sports betting. You must be of legal betting age where you live to continue.
        </p>
        <button type="button" onClick={onOk} className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background">
          I am {MIN_AGE} or older
        </button>
        <a href="https://www.ncpgambling.org/" rel="noopener" target="_blank" className="text-xs text-muted-foreground underline">Leave</a>
      </div>
    </div>
  );
}

export function PublicShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [ageOk, setAgeOk] = useState(true); // the server renders the page; the check runs once the browser has storage
  useEffect(() => {
    try { setAgeOk(localStorage.getItem(AGE_KEY) === "1"); } catch { setAgeOk(false); }
  }, []);
  const accept = () => {
    try { localStorage.setItem(AGE_KEY, "1"); } catch { /* private window: ask again next visit */ }
    setAgeOk(true);
  };
  return (
    <div>
      <div className="border-b">
        <nav aria-label="PickLab" className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2">
          <Link href="/picklab" className="pl-display shrink-0 text-xl leading-none tracking-wide">Pick<span className="text-[var(--hot)]">Lab</span></Link>
          <div className="flex min-w-0 flex-1 gap-0.5 overflow-x-auto sm:gap-1">
            {LINKS.map((l) => {
              const active = l.exact ? path === l.href : path.startsWith(l.href);
              return (
                <Link key={l.href} href={l.href} aria-current={active ? "page" : undefined}
                  className={`pl-label shrink-0 rounded-full px-2.5 py-1.5 text-[10px] sm:px-3 sm:text-[11px] ${active ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}>
                  {l.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:py-10">{children}</main>
      <div className="mx-auto grid max-w-6xl gap-3 border-t px-4 py-6 text-xs leading-relaxed text-muted-foreground">
        <p className="font-medium text-foreground">
          {MIN_AGE}+ (or the legal age where you live). {HELP.map((h) => h.text).join(" ")}
        </p>
        <p>
          Information only, not betting advice. Picks belong to the publishers named on each one and link to their
          articles; results are graded by PickLab. Past results don&apos;t predict future ones. Sports betting isn&apos;t legal
          everywhere: check your local laws.
        </p>
        <p><Link href="/picklab/sources" className="underline">Sources, method and what we leave out</Link></p>
      </div>
      {!ageOk && <AgeGate onOk={accept} />}
    </div>
  );
}
