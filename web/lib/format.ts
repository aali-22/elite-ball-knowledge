// Display helpers. Times arrive in UTC and are shown in the browser's local zone.

export const localDateTime = (iso: string) =>
  new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export const localTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export function relative(iso: string, now = Date.now()): string {
  const s = Math.round((new Date(iso).getTime() - now) / 1000);
  const abs = Math.abs(s);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (abs < 60) return rtf.format(s, "second");
  if (abs < 3600) return rtf.format(Math.round(s / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(s / 3600), "hour");
  return rtf.format(Math.round(s / 86400), "day");
}

const MARKETS: Record<string, string> = {
  moneyline: "Moneyline",
  run_line: "Run line",
  total: "Total",
  team_total: "Team total",
  pitcher_strikeouts: "Strikeouts",
  pitcher_hits_allowed: "Hits allowed",
  pitcher_outs: "Outs recorded",
  pitcher_earned_runs: "Earned runs",
  pitcher_walks: "Walks",
};

export const marketLabel = (m: string) => MARKETS[m] ?? m.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

export const REJECT_LABELS: Record<string, string> = {
  stale: "Stale",
  wrong_event: "Wrong game",
  wrong_personnel: "Wrong starter",
  wrong_competition: "Wrong competition",
  operator_content: "Sportsbook content",
  not_read: "Not read",
  snippet_lacks_pick: "Snippet lacks pick",
  paywalled_no_pick: "Paywalled",
  blocked: "Blocked",
  js_rendered: "JS-rendered",
  duplicate_site: "Duplicate",
  duplicate_author: "Duplicate author",
  published_after_start: "After first pitch",
  thin_affiliate: "Thin affiliate",
  other: "Other",
};
