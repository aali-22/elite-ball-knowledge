"use client";

// What every public page sits inside: the component library's theme (following the site's light / dark switch), page
// changes that carry shared elements across (a crest gliding from a card to the page's head), and the search box.
import { LinkProvider } from "@astryxdesign/core/Link";
import { Theme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral/built";
import dynamic from "next/dynamic";
import NextLink from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, use, useCallback, useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import { pageview } from "@/lib/analytics";
import { useIsDark } from "@/lib/theme";

// ---- page changes ------------------------------------------------------------------------------------------------
type Nav = (href: string) => void;
const NavContext = createContext<Nav>(() => {});
/** Go to a page inside a view transition where the browser has one (and the visitor hasn't asked for less motion). */
export const useViewNav = () => use(NavContext);

type Doc = Document & { startViewTransition?: (cb: () => Promise<void> | void) => unknown };

function ViewNav({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const done = useRef<(() => void) | null>(null);
  useEffect(() => { done.current?.(); done.current = null; }, [path]); // the new page is on screen: let the transition finish
  useEffect(() => { pageview(); }, [path]); // counted once per page (lib/analytics: nothing happens unless analytics is on)
  const go = useCallback<Nav>((href) => {
    const doc = document as Doc;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!doc.startViewTransition || still) return router.push(href);
    doc.startViewTransition(() => new Promise<void>((resolve) => {
      done.current = resolve;
      setTimeout(resolve, 1200); // never hold the old page hostage if the route is slow
      router.push(href);
    }));
  }, [router]);
  return <NavContext value={go}>{children}</NavContext>;
}

/** A link that changes page through the view transition. Modified clicks (new tab, etc.) stay the browser's. */
export function ViewLink({ href, children, className, style, ...rest }: { href: string; children: React.ReactNode; className?: string; style?: React.CSSProperties } & Omit<React.ComponentProps<typeof NextLink>, "href">) {
  const go = useViewNav();
  return (
    <NextLink href={href} className={className} style={style} {...rest}
      onClick={(e) => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        go(href);
      }}>
      {children}
    </NextLink>
  );
}

// ---- search (components/ebk/Search.tsx, downloaded the first time it is opened) ----------------------------------------
const SearchContext = createContext<() => void>(() => {});
export const useOpenSearch = () => use(SearchContext);
const Search = dynamic(() => import("./Search").then((m) => m.Search), { ssr: false });

export function Shell({ children }: { children: React.ReactNode }) {
  const dark = useIsDark();
  const [open, setOpen] = useState(false);
  const [everOpened, setEverOpened] = useState(false);
  useEffect(() => { if (open) setEverOpened(true); }, [open]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((v) => !v); }
      else if (e.key === "/" && !/^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement)?.tagName ?? "") && !(e.target as HTMLElement)?.isContentEditable) { e.preventDefault(); setOpen(true); track("search_open", { via: "key" }); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const openSearch = useCallback(() => { setOpen(true); track("search_open", { via: "button" }); }, []);
  return (
    <Theme theme={neutralTheme} mode={dark ? "dark" : "light"}>
      <LinkProvider component={NextLink}>
        <ViewNav>
          <SearchContext value={openSearch}>
            {children}
            {everOpened && <Search open={open} setOpen={setOpen} />}
          </SearchContext>
        </ViewNav>
      </LinkProvider>
    </Theme>
  );
}
