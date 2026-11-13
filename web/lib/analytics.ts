// Visit counting, in one place and with no package: Google Analytics 4 through gtag.js, loaded only when the build
// carries a measurement id (lib/site GA_ID). Without one nothing here does anything: no script, no cookie, no request,
// and track() is a no-op, so components can call it unconditionally.
//
// With one it is on for every visitor, with these limits:
//   - advertising is off for good: consent for ad storage, ad user data and ad personalisation is denied, Google
//     signals are off, and no ad feature is ever asked for;
//   - a visitor who turned it off (CHOICE_KEY in the browser's storage), or whose browser sends Global Privacy
//     Control, gets no script and no request, and Google's own per-property kill switch is set before anything loads;
//   - events are a short fixed list with coarse parameters (a sport, a kind of finding, an outlet). Never a name, an
//     id of a person, an address or free text.
// No "use client": it is plain browser code that every function guards, so the server can import the types.
import { GA_ID, isPickLab } from "./site";

export const ANALYTICS = GA_ID !== "";
/** The visitor's stored choice: "1" = off, "0" = seen the notice and left it on. Absent = not asked yet. */
export const CHOICE_KEY = "ebk-analytics-off";
const SCRIPT = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;

/** Every event the site sends, with the only parameters each may carry. */
export type Events = {
  game_view: { sport: string };
  finding_open: { which: "numbers" | "league"; kind?: string; sport?: string };
  edge_deck_move: { to: "next" | "prev" | "card"; sport?: string };
  schedule_toggle: { on: boolean; sport?: string };
  board_row_open: { sport?: string; part?: string };
  compare_teams: { sport: string };
  league_stat_pick: { sport: string; part?: string };
  search_open: { via: "key" | "button" };
  search_select: { kind: "team" | "player" | "game"; sport?: string };
  picklab_visit: { page: "picks" | "experts" | "strategies" };
  article_click: { outlet: string; sport?: string };
  share: { kind: "game" | "finding" | "page"; method: "native" | "copy"; sport?: string };
  account_action: { action: "sign_in" | "sign_up" | "sign_out" | "reset" | "delete" };
  plan_action: { action: "view" | "checkout" | "manage" };
};
export type EventName = keyof Events;

type Gtag = (...args: unknown[]) => void;
type Win = Window & { dataLayer?: unknown[]; gtag?: Gtag } & Record<string, unknown>;
type Nav = Navigator & { globalPrivacyControl?: boolean };

const browser = () => typeof window !== "undefined";
const stored = (): string | null => {
  try { return localStorage.getItem(CHOICE_KEY); } catch { return null; }  // storage blocked: no stored choice
};

/** The browser asks not to be tracked across sites (Global Privacy Control): treated as "off", and not overridable here. */
export const gpc = () => browser() && (navigator as Nav).globalPrivacyControl === true;
/** What the visitor chose: "off", "on" (saw the notice, kept it), or null when they have not been asked. */
export const choice = (): "on" | "off" | null => (!browser() ? null : stored() === "1" ? "off" : stored() === "0" ? "on" : null);
/** Whether anything is sent for this visitor right now. */
export const enabled = () => ANALYTICS && browser() && !gpc() && choice() !== "off";

let loaded = false;

/** Load gtag.js once, or, for a visitor who is opted out, set Google's kill switch and load nothing. */
function start(): boolean {
  if (!ANALYTICS || !browser()) return false;
  const w = window as unknown as Win;
  if (!enabled()) { w[`ga-disable-${GA_ID}`] = true; return false; }
  if (loaded) return true;
  loaded = true;
  w[`ga-disable-${GA_ID}`] = false;
  w.dataLayer = w.dataLayer ?? [];
  // gtag.js reads the `arguments` object itself off the queue; an array pushed in its place is ignored
  // eslint-disable-next-line prefer-rest-params
  w.gtag = function gtag() { w.dataLayer!.push(arguments); };
  w.gtag("consent", "default", { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", analytics_storage: "granted" });
  w.gtag("js", new Date());
  w.gtag("config", GA_ID, { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false,
    page_location: location.origin + reportedPath(location.pathname, location.search), page_referrer: reportedReferrer() });
  const s = document.createElement("script");
  s.async = true;
  s.src = SCRIPT;
  document.head.appendChild(s);
  return true;
}

// ---- the visitor's choice --------------------------------------------------------------------------------------------
const listeners = new Set<() => void>();
/** For useSyncExternalStore: runs `fn` when the choice changes, here or in another tab. */
export function subscribe(fn: () => void) {
  listeners.add(fn);
  const onStorage = (e: StorageEvent) => { if (e.key === CHOICE_KEY) fn(); };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(fn); window.removeEventListener("storage", onStorage); };
}

/** Google Analytics' own cookies (`_ga`, `_ga_<property>`), removed on every domain this host could have set them on. */
function dropCookies() {
  const names = document.cookie.split(";").map((c) => c.split("=")[0].trim()).filter((n) => n === "_ga" || n.startsWith("_ga_"));
  const parts = location.hostname.split(".");
  const domains = ["", ...parts.map((_, i) => parts.slice(i).join(".")).filter((d) => d.includes("."))];
  for (const n of names) for (const d of domains) document.cookie = `${n}=; path=/; max-age=0${d ? `; domain=.${d}` : ""}`;
}

/** Turn visit counting off or on for this browser. Off takes effect at once: nothing more is sent and its cookies go.
 *  On, from the notice's "OK", only records that the visitor has seen it; on, after off, starts counting again. */
export function setAnalytics(on: boolean) {
  if (!ANALYTICS || !browser()) return;
  const was = choice();
  try { localStorage.setItem(CHOICE_KEY, on ? "0" : "1"); } catch { /* storage blocked: the choice lasts for this page only */ }
  const w = window as unknown as Win;
  if (!on) {
    w[`ga-disable-${GA_ID}`] = true;
    w.gtag?.("consent", "update", { analytics_storage: "denied" });
    dropCookies();
  } else if (was === "off" && !gpc()) {
    w[`ga-disable-${GA_ID}`] = false;
    w.gtag?.("consent", "update", { analytics_storage: "granted" });
    pageview();
  }
  listeners.forEach((fn) => fn());
}

// ---- what is sent ----------------------------------------------------------------------------------------------------
function emit(event: string, params: Record<string, unknown>) {
  if (!start() || !enabled()) return;
  (window as unknown as Win).gtag?.("event", event, params);
}

/** A parameter is a short label or a number. Anything that could be a person's (an address, a long string) is dropped. */
const safe = (v: unknown): v is string | number | boolean =>
  typeof v === "number" || typeof v === "boolean" || (typeof v === "string" && v.length <= 40 && !v.includes("@"));

/** One product event. A no-op without a measurement id, for an opted-out visitor, and on the server. */
export function track<E extends EventName>(event: E, params: Events[E]) {
  emit(event, Object.fromEntries(Object.entries(params).filter(([, v]) => safe(v))));
}

/** An article's outlet for `article_click`: the host of its address, nothing else of it. */
export function outletOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "unknown"; }
}

// The only query keys a page view carries: the site's own view state (a league, two teams, a filter, a finding).
// Anything else in an address (a password-reset key, a search someone typed) is left out.
const QUERY_KEYS = ["sport", "a", "b", "kind", "view", "trait", "sort", "numbers", "f"];
/** The address as it is reported: the path, plus the view-state part of the query. */
export function reportedPath(pathname: string, search: string): string {
  const q = new URLSearchParams(search), keep = new URLSearchParams();
  for (const k of QUERY_KEYS) { const v = q.get(k); if (v && v.length <= 80) keep.set(k, v); }
  const tail = keep.toString();
  return tail ? `${pathname}?${tail}` : pathname;
}

/** Where the visitor came from, as it is reported: another site's address as the browser gives it, a page of this
 *  site trimmed the same way as the page itself. */
function reportedReferrer(): string {
  try {
    const from = new URL(document.referrer);
    return from.origin === location.origin ? from.origin + reportedPath(from.pathname, from.search) : document.referrer;
  } catch { return ""; }  // no referrer
}

const PICKLAB_PAGE: Record<string, Events["picklab_visit"]["page"]> = { "/picklab": "picks", "/picklab/experts": "experts", "/picklab/strategies": "strategies" };

/** The page now on screen: sent once per route change (components/ebk/Shell). Game and PickLab pages also count as
 *  their own events, read off the path. */
export function pageview() {
  if (!ANALYTICS || !browser()) return;
  const path = location.pathname, page = reportedPath(path, location.search);
  if (!start() || !enabled()) return;
  // set first, so this page view and every event after it report the trimmed address, never the browser's raw one
  (window as unknown as Win).gtag?.("set", { page_location: location.origin + page, page_path: page });
  emit("page_view", { page_location: location.origin + page, page_path: page });
  const game = /^\/game\/(nba|nfl|soc)[-:]/.exec(path);
  if (game) track("game_view", { sport: game[1] === "soc" ? "soccer" : game[1] });
  if (isPickLab(path) && PICKLAB_PAGE[path]) track("picklab_visit", { page: PICKLAB_PAGE[path] });
}
