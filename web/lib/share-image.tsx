// The picture a link to a game shows when it is shared: drawn on the server per request, 1200 x 630, in the site's
// dark look. Words and marks only: the two team names, the lead finding (or the one a link names) as the page frames
// it, where its ranks sit in the league, and the model's win share with the model's name on it. No team logo, no
// photo, and no request to any host but the site's own API. Only ever imported by server routes.
//
// It never throws and never answers anything but a picture: with no API, an unknown game or a drawing that fails it is
// the site's plain card, because a broken image route breaks every link preview that points at it.
import { ImageResponse } from "next/og";
import { Q, SHAPE } from "@/lib/ebk-queries";
import { frame, type Frame } from "@/lib/framing";
import { ord } from "@/lib/ordinal";
import type { Schemas } from "@/lib/http";
import { load } from "@/lib/server/ebk";
import { AWAY, HOME, SITE } from "@/lib/site";

type Board = Schemas["PublicBoard"];
type Insight = Schemas["Insight"];
type Tree = Schemas["PublicTree"];

export const SHARE_SIZE = { width: 1200, height: 630 };
const BG = "#0b0b0b", INK = "#ecebe6", MUTE = "#8f8d86", HOT = "#ff3b1f", PANEL = "#151514", LINE = "#2c2c2a";
const LEAGUE: Record<string, string> = { nba: "NBA", nfl: "NFL", soccer: "SOCCER" };
// Link previews are fetched by other sites' servers: let them keep a card for a few minutes, never for good (the
// lead finding of a game changes when its breakdown is rebuilt).
const CACHE = "public, max-age=300, s-maxage=600, stale-while-revalidate=86400";

/** Text the bundled face can draw: accents folded away, typographic marks made plain, anything else dropped (a glyph
 *  the face lacks would otherwise be looked up on a font host). */
const plain = (s: string | null | undefined) => (s ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[‘’]/g, "'")
  .replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/[^\x20-\x7e·]/g, "").trim();
const sentence = (s?: string | null) => (s ?? "").split(/(?<=[.!?])\s/)[0] ?? "";
/** `s` in at most `n` letters, never cut mid-thought where it can be helped: it ends at its last whole clause that
 *  fits, and only a text with no such break is cut at a word and marked as cut. */
function clip(s: string, n: number): string {
  if (s.length <= n) return s;
  const head = s.slice(0, n), stop = Math.max(head.lastIndexOf(". "), head.lastIndexOf("; "), head.lastIndexOf(": "));
  return stop >= n * 0.4 ? `${head.slice(0, stop)}.` : `${head.slice(0, n - 3).replace(/[\s,;:.]+\S*$/, "")}...`;
}
/** A size at which `text` fits `width` on one line: `em` is a letter's average width (capitals 0.66, sentence case 0.5). */
const fit = (text: string, width: number, max: number, min: number, em = 0.66) => Math.max(min, Math.min(max, Math.floor(width / (Math.max(text.length, 1) * em))));

/** What the card says about a finding: the page's own framing (lib/framing), or the finding's title and first sentence. */
function framed(i: Insight, b: Board): Frame {
  try { return frame(i, b); } catch { return { shape: "plain", stat: i.title, headline: i.title, meaning: sentence(i.claim) }; }
}

/** Where a finding's ranks sit in the league: [share of the way from best to worst, colour, filled]. */
function marks(i: Insight, b: Board): { at: number; color: string; solid: boolean; label: string }[] {
  const ink = (team?: string | null) => (team === b.home.team ? HOME.hex : team === b.away.team ? AWAY.hex : INK);
  const at = (rank: number, of: number) => (of > 1 ? (Math.min(rank, of) - 1) / (of - 1) : 0);
  const v = i.viz as { type?: string; team?: string; raw_rank?: number; adj_rank?: number | null; of?: number };
  if (v.type === "rank_shift" && v.raw_rank && v.of) {
    const adj = v.adj_rank ?? v.raw_rank;
    return [...(adj === v.raw_rank ? [] : [{ at: at(v.raw_rank, v.of), color: MUTE, solid: false, label: ord(v.raw_rank) }]), { at: at(adj, v.of), color: ink(v.team), solid: true, label: ord(adj) }];
  }
  return i.numbers.slice(0, 2).flatMap((n) => (n.rank && n.of ? [{ at: at(n.rank, n.of), color: ink(n.team), solid: true, label: ord(n.rank) }] : []));
}

/** The model's favourite and its win share as the game page states it: the simulation where there is one, else the
 *  score model's "who wins" shares. */
function modelOf(b: Board, tree: Tree | null | undefined): { team: string; p: number; from: string } | null {
  const sim = b.simulation as Record<string, unknown> | null;
  let h = typeof sim?.home_win === "number" ? sim.home_win : null, a = h == null ? null : typeof sim?.away_win === "number" ? sim.away_win : 1 - h;
  let from = "SIMULATION";
  if (h == null || a == null) {
    const node = (k: string) => tree?.nodes.find((n) => n.id === k)?.p ?? null;
    h = node("w:home"); a = node("w:away"); from = "SCORE MODEL";
  }
  if (h == null || a == null || !(h >= 0 && h <= 1 && a >= 0 && a <= 1)) return null;
  return { team: h >= a ? b.home.name || b.home.team : b.away.name || b.away.team, p: Math.max(h, a), from };
}

const label = (color: string, size = 20): React.CSSProperties => ({ display: "flex", fontSize: size, letterSpacing: 4, color });

function Shell({ kicker, children }: { kicker: string; children: React.ReactNode }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", padding: "44px 56px 48px", background: BG, color: INK }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={label(HOT, 22)}>{kicker}</div>
        <div style={label(MUTE, 22)}>{SITE.name.toUpperCase()}</div>
      </div>
      {children}
    </div>
  );
}

/** The site's plain card: what a link shows when there is no game to draw. */
function Generic() {
  const bars = [0.92, 0.61, 0.78, 0.34, 0.86, 0.5, 0.7];
  return (
    <Shell kicker="SPORTS ANALYTICS, SHOWN NOT TOLD">
      <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center", fontSize: 150, lineHeight: 0.94, letterSpacing: -3 }}>
        <div style={{ display: "flex" }}>ELITE BALL</div>
        <div style={{ display: "flex", color: HOT }}>KNOWLEDGE</div>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div style={{ display: "flex", fontSize: 30, color: MUTE, maxWidth: 640 }}>{SITE.tagline} Every claim next to the chart that proves it.</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 110 }}>
          {bars.map((v, i) => <div key={i} style={{ width: 26, height: `${v * 100}%`, borderRadius: 6, background: i % 2 ? AWAY.hex : HOME.hex }} />)}
        </div>
      </div>
    </Shell>
  );
}

function Team({ name, color, size }: { name: string; color: string; size: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
      <div style={{ width: 16, height: size * 0.7, borderRadius: 4, background: color }} />
      <div style={{ display: "flex", fontSize: size, lineHeight: 1, letterSpacing: -2 }}>{name}</div>
    </div>
  );
}

const PANEL_BOX: React.CSSProperties = { display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "22px 28px", borderRadius: 24, border: `1px solid ${LINE}`, background: PANEL };

/** Where the finding's ranks sit between the league's best and worst. */
function Ruler({ dots }: { dots: ReturnType<typeof marks> }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <div style={label(MUTE, 16)}>1ST</div>
      <div style={{ display: "flex", position: "relative", flex: 1, height: 22, alignItems: "center" }}>
        <div style={{ display: "flex", width: "100%", height: 2, background: LINE }} />
        {dots.map((d, i) => (
          <div key={i} style={{ display: "flex", position: "absolute", left: `${d.at * 97}%`, top: 2, width: 18, height: 18, borderRadius: 9,
            background: d.solid ? d.color : PANEL, border: `3px solid ${d.color}` }} />
        ))}
      </div>
      <div style={label(MUTE, 16)}>LAST</div>
    </div>
  );
}

function Game({ b, finding, tree }: { b: Board; finding?: Insight; tree?: Tree | null }) {
  const away = plain(b.away.name || b.away.team).toUpperCase(), home = plain(b.home.name || b.home.team).toUpperCase();
  const size = Math.min(fit(away, 1040, 112, 60), fit(home, 1040, 112, 60));
  const f = finding ? framed(finding, b) : null, dots = finding ? marks(finding, b) : [];
  const model = modelOf(b, tree);
  const wide = model ? 712 : 1032;  // the finding's panel, inside its padding
  const stat = f ? clip(plain(f.stat).toUpperCase(), model ? 44 : 64) : "THE BREAKDOWN";
  const headline = f ? clip(plain(f.headline), model ? 76 : 110) : "Both teams on one scale.";
  // the panel holds four lines of text: a headline too long for one line takes two, and the meaning then keeps to one
  const one = fit(headline, wide, 54, 0, 0.5) >= 34;
  const meaning = f ? clip(plain(f.meaning), Math.round((one ? 2 : 1) * wide / 12.6)) : "Every matchup, and the findings the numbers support.";
  // a headline that isn't the stat again (a finding without two ranks keeps its title as both)
  const twice = f != null && plain(f.stat).toLowerCase() === plain(f.headline).toLowerCase();
  return (
    <Shell kicker={`${LEAGUE[b.sport] ?? plain(b.sport).toUpperCase()} \u00b7 ${f ? "WHAT DECIDES IT" : "GAME BREAKDOWN"}`}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 30 }}>
        <Team name={away} color={AWAY.hex} size={size} />
        <Team name={home} color={HOME.hex} size={size} />
      </div>
      <div style={{ display: "flex", flex: 1, gap: 20, marginTop: 30 }}>
        <div style={{ ...PANEL_BOX, flex: 1 }}>
          {!twice && <div style={label(MUTE, 19)}>{stat}</div>}
          <div style={{ display: "flex", fontSize: one ? fit(headline, wide, 54, 34, 0.5) : 34, lineHeight: 1.08, letterSpacing: -1 }}>{headline}</div>
          {dots.length > 0 && <Ruler dots={dots} />}
          <div style={{ display: "flex", fontSize: 23, lineHeight: 1.25, color: MUTE }}>{meaning}</div>
        </div>
        {model && (
          <div style={{ ...PANEL_BOX, width: 300 }}>
            <div style={label(MUTE, 19)}>{model.from}</div>
            <div style={{ display: "flex", fontSize: 104, lineHeight: 1, letterSpacing: -3 }}>{Math.round(model.p * 100)}%</div>
            <div style={{ display: "flex", fontSize: 21, lineHeight: 1.2, color: MUTE }}>{clip(plain(model.team), 22)} win share</div>
          </div>
        )}
      </div>
    </Shell>
  );
}

const png = async (node: React.ReactElement) => new Response(await new ImageResponse(node, SHARE_SIZE).arrayBuffer(), { headers: { "content-type": "image/png", "cache-control": CACHE } });

/** A game's lead finding, or the one a link names (`?f=<finding id>`), as the page orders them. */
export function sharedFinding(b: Board, id?: string | null): Insight | undefined {
  return (id ? b.insights.find((i) => i.id === id) : undefined) ?? b.insights.find((i) => i.kind !== "balance") ?? b.insights[0];
}

/** The picture for one game. `finding` is a finding's id from the link; unknown or absent, the game's lead finding. */
export async function gameImage(id: string, finding?: string | null): Promise<Response> {
  try {
    const b = SHAPE.game.test(id) ? await load<Board>(Q.game(id).path).catch(() => null) : null;
    if (b) {
      const tree = b.simulation && typeof (b.simulation as Record<string, unknown>).home_win === "number" ? null
        : await load<Tree>(Q.tree(id).path).catch(() => null);
      return await png(<Game b={b} finding={sharedFinding(b, finding)} tree={tree} />);
    }
  } catch { /* fall through to the plain card */ }
  try {
    return await png(<Generic />);
  } catch {
    // the drawing itself is unavailable: still an image, one transparent pixel, never an error page
    const dot = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="), (c) => c.charCodeAt(0));
    return new Response(dot, { headers: { "content-type": "image/png", "cache-control": "no-store" } });
  }
}
