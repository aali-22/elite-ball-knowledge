// Team marks and player photos for the public pages: decoration beside a name, never the only cue. Every image is
// hotlinked from the league data provider's image host by the id the boards already carry, and falls back to a drawn
// monogram when there is none (invented demo teams, a club without a crest). One switch turns the whole layer off:
// NEXT_PUBLIC_TEAM_MEDIA=0 leaves monograms everywhere and the page loads no third-party image.
export const MEDIA = process.env.NEXT_PUBLIC_TEAM_MEDIA !== "0";

// The play-by-play and box-score codes differ from the image host's in a few places.
const NFL_CODE: Record<string, string> = { WAS: "wsh", LA: "lar" };
const NBA_CODE: Record<string, string> = { UTAH: "utah", NY: "ny", GS: "gs", SA: "sa", NO: "no", WSH: "wsh" };

/** A team's logo URL (the dark-background variant on the dark theme), or null when there is none to show. */
export function teamLogo(sport: string, team: string, dark = false): string | null {
  if (!MEDIA) return null;
  if (sport === "soccer") {
    const id = team.replace(/^soc[:-]/, "");
    return /^\d+$/.test(id) ? `https://images.fotmob.com/image_resources/logo/teamlogo/${id}.png` : null;
  }
  if (sport !== "nba" && sport !== "nfl") return null;
  if (!/^[A-Z]{2,4}$/.test(team)) return null;
  const code = (sport === "nfl" ? NFL_CODE[team] : NBA_CODE[team]) ?? team.toLowerCase();
  return `https://a.espncdn.com/i/teamlogos/${sport}/${dark ? "500-dark" : "500"}/scoreboard/${code}.png`;
}

/** A player's headshot (NBA ids are the image host's own; NFL ids are not, so NFL players get a monogram). */
export function headshot(playerId: string): string | null {
  if (!MEDIA) return null;
  const m = playerId.match(/^nba[:-]p(\d{3,9})$/);
  return m ? `https://a.espncdn.com/combiner/i?img=${encodeURIComponent(`/i/headshots/nba/players/full/${m[1]}.png`)}&w=192&h=140` : null;
}

export const initials = (name: string, code?: string) =>
  code && /^[A-Z]{2,4}$/.test(code) ? code : name.split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 3).toUpperCase();
