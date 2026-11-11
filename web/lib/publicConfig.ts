// Monetisation and compliance settings for the public view. Everything is a placeholder: no ad network script, no
// tracking pixel and no affiliate link is loaded. A real release fills these in after the checklist on /public/sources.

/** Ad slots render as labelled empty boxes until a network is chosen (`network` stays null: nothing is requested). */
export const ADS = {
  network: null as null | "adsense" | "ezoic" | "direct",
  showPlaceholders: true, // false hides the boxes entirely (e.g. a screenshot without ads)
};

/** Sportsbook affiliate partners. Empty, so the partner rail doesn't render: there is no signed agreement or state /
 * provincial affiliate registration, and Ontario bans public inducement advertising (AGCO Standard 2.05). No placeholder
 * copy either; add a partner only after legal review (docs/public-release-risk.md, R7). `url: null` = not clickable. */
export type Affiliate = { id: string; name: string; offer: string; terms: string; url: string | null; regions: string[] };
export const AFFILIATES: Affiliate[] = [];

/** Responsible-gambling lines shown in the footer of every public page. */
export const HELP = [
  { region: "US", text: "Gambling problem? Call 1-800-GAMBLER." },
  { region: "Ontario", text: "ConnexOntario: 1-866-531-2600." },
];

export const MIN_AGE = 21; // the strictest US age; 19 in most of Canada, 18 in Quebec, Alberta and Manitoba

export const AGE_KEY = "picklab-public-age-ok";
