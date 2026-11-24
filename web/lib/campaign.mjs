// The tag one of the site's own links may carry, so a visit can be counted by where its link was posted
// (lib/analytics.ts). Every part comes from a fixed list written here: a tag is a channel and a placement, never a
// person, a post or free text, and a stranger's link cannot make the site report a word that is not on a list.
// Plain JavaScript with its types beside it (campaign.d.mts), so a test can read the lists without a build.

/** Where the link was posted. */
export const SOURCES = ["instagram", "reddit", "bluesky", "tiktok", "outreach"];
/** The kind of traffic, in the words Google Analytics groups channels by. */
export const MEDIUMS = ["social", "email", "referral"];
/** Which run of posts the link belongs to. */
export const CAMPAIGNS = ["gtm1"];
/** Where on that site the link sat. */
export const CONTENTS = ["bio", "story", "post", "comment", "link"];

const LISTS = [["utm_source", SOURCES], ["utm_medium", MEDIUMS], ["utm_campaign", CAMPAIGNS], ["utm_content", CONTENTS]];

/** The tag in a query string as it is reported: "" or "utm_source=…&utm_medium=…[&utm_campaign=…][&utm_content=…]".
 *  A source and a medium must both be on their lists, or the whole tag is dropped; a campaign or a content that is
 *  not on its list is dropped by itself. Capitals are folded. No other utm_ key, and no click id, is ever kept. */
export function campaignOf(search) {
  const q = new URLSearchParams(search), kept = [];
  for (const [key, list] of LISTS) {
    const v = (q.get(key) ?? "").toLowerCase();
    if (list.includes(v)) kept.push([key, v]);
    else if (key === "utm_source" || key === "utm_medium") return "";
  }
  return new URLSearchParams(kept).toString();
}

/** A query string with every utm_ key taken out (for the address bar, once the tag has been counted): "" or "?…". */
export function withoutTag(search) {
  const q = new URLSearchParams(search);
  for (const key of [...q.keys()]) if (key.toLowerCase().startsWith("utm_")) q.delete(key);
  const rest = q.toString();
  return rest ? `?${rest}` : "";
}

/** Whether a query string carries any utm_ key at all. */
export const hasTag = (search) => [...new URLSearchParams(search).keys()].some((key) => key.toLowerCase().startsWith("utm_"));
