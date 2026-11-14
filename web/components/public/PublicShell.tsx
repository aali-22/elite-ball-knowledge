"use client";

// The PickLab section's frame: its own sub-navigation, an age check, and the responsible-gambling footer on every page.
import { Lock } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ViewerProvider } from "@/components/picklab/Context";
import { AGE_KEY, HELP, MIN_AGE } from "@/lib/publicConfig";

// Four places, each a different question: what is on today, every game, who is right, and how the site's own paper
// strategies have done. A game's own page belongs to Today.
const LINKS = [
  { href: "/picklab", label: "Today", on: (p: string) => p === "/picklab" || p.startsWith("/picklab/game/") },
  { href: "/picklab/games", label: "Games", on: (p: string) => p === "/picklab/games" },
  { href: "/picklab/experts", label: "Experts", on: (p: string) => p.startsWith("/picklab/experts") },
  { href: "/picklab/strategies", label: "Record", on: (p: string) => p.startsWith("/picklab/strategies") },
];

function AgeGate({ onOk }: { onOk: () => void }) {
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => { first.current?.focus(); }, []);  // keyboard and screen-reader users land in the gate, not behind it
  return (
    <div role="dialog" aria-modal aria-labelledby="age-title" className="grid min-h-[60dvh] place-items-center p-4">
      <div className="grid max-w-sm gap-4 rounded-xl border bg-card p-6 text-center">
        <h1 id="age-title" className="pl-display text-4xl">{MIN_AGE}+ only</h1>
        <p className="text-sm text-muted-foreground">
          PickLab, this section of the site, is about sports betting picks. You must be of legal betting age where you live to continue.
        </p>
        <button ref={first} type="button" onClick={onOk} className="min-h-11 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background">
          I am {MIN_AGE} or older
        </button>
        <Link href="/" className="text-sm text-muted-foreground underline underline-offset-4">Leave PickLab</Link>
      </div>
    </div>
  );
}

/** `invited`: an account on the invitation list (no age question: the invitation is the check). `owner`: the account
 *  that also has a workspace of its own, reached by the lock at the end of the bar. */
export function PublicShell({ children, invited = false, owner = false }: { children: React.ReactNode; invited?: boolean; owner?: boolean }) {
  const path = usePathname();
  // null until the browser's storage has been read: nothing in this section is drawn before the answer is known.
  const [ageOk, setAgeOk] = useState<boolean | null>(invited ? true : null);
  useEffect(() => {
    if (invited) return;
    try { setAgeOk(localStorage.getItem(AGE_KEY) === "1"); } catch { setAgeOk(false); }
  }, [invited]);
  const accept = () => {
    try { localStorage.setItem(AGE_KEY, "1"); } catch { /* private window: ask again next visit */ }
    setAgeOk(true);
  };
  const viewer = useMemo(() => ({ invited, owner }), [invited, owner]);
  return (
    <ViewerProvider value={viewer}>
      <div className="border-b">
        <nav aria-label="PickLab" className="mx-auto flex max-w-7xl items-center gap-2 px-3 py-1.5 sm:gap-4 sm:px-4 sm:py-2">
          <Link href="/picklab" className="pl-display hidden shrink-0 text-xl leading-none tracking-wide sm:block">Pick<span className="text-[var(--hot)]">Lab</span></Link>
          {/* four equal parts on a phone, so nothing is cut off or scrolls sideways */}
          <div className="grid min-w-0 flex-1 grid-cols-4 gap-1 sm:flex sm:flex-none">
            {LINKS.map((l) => {
              const active = l.on(path);
              return (
                <Link key={l.href} href={l.href} aria-current={active ? "page" : undefined}
                  className={`pl-label flex min-h-10 items-center justify-center rounded-lg px-1 text-[11px] sm:min-h-9 sm:px-4 ${active ? "bg-[var(--hot)] font-medium text-[var(--hot-ink)]" : "text-muted-foreground hover:text-foreground"}`}>
                  {l.label}
                </Link>
              );
            })}
          </div>
          {owner && (
            // eslint-disable-next-line @next/next/no-html-link-for-pages -- a new document applies the workspace's own security policy
            <a href="/account/workspace" aria-label="Your private workspace" title="Your private workspace"
              className="pl-label inline-flex size-10 shrink-0 items-center justify-center gap-2 rounded-lg text-[11px] text-muted-foreground hover:text-foreground sm:ml-auto sm:w-auto sm:px-3">
              <Lock aria-hidden className="size-4" /><span className="hidden sm:inline">Workspace</span>
            </a>
          )}
        </nav>
      </div>
      {ageOk === true && <main className="mx-auto w-full max-w-7xl px-4 py-4 sm:py-8">{children}</main>}
      {ageOk === false && <AgeGate onOk={accept} />}
      {ageOk === null && <div className="min-h-[60dvh]" />}
      <div className="mx-auto grid max-w-7xl gap-3 border-t px-4 py-6 text-xs leading-relaxed text-muted-foreground">
        <p className="font-medium text-foreground">
          {MIN_AGE}+ (or the legal age where you live). {HELP.map((h) => h.text).join(" ")}
        </p>
        <p>
          Information only, not betting advice. Picks belong to the publishers named on each one and link to their
          articles; results are graded by PickLab. Past results don&apos;t predict future ones. Sports betting isn&apos;t legal
          everywhere: check your local laws. These pages use the prices analysts listed and the prices our paper picks took; the
          analytics pages elsewhere on the site use no prices at all.
        </p>
        <p><Link href="/sources" className="underline">Sources, method and what we leave out</Link></p>
      </div>
    </ViewerProvider>
  );
}
