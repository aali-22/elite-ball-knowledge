import type { MetadataRoute } from "next";
import { ACCOUNTS, PICKLAB, SITE_URL } from "@/lib/site";

// The pages that always exist. Game, team and player pages change with the slate and are reached from these.
const PAGES: [string, MetadataRoute.Sitemap[number]["changeFrequency"], number][] = [
  ["/", "daily", 1], ["/games", "daily", 0.9], ["/findings", "daily", 0.9], ["/league/nba", "daily", 0.8], ["/league/nfl", "daily", 0.8],
  ["/compare", "weekly", 0.6], ["/models", "monthly", 0.6], ["/sources", "monthly", 0.4], ["/privacy", "yearly", 0.2],
  // PickLab's pages are listed only where the section is on (lib/site PICKLAB)
  ...(PICKLAB ? [["/picklab", "daily", 0.6], ["/picklab/experts", "daily", 0.6], ["/picklab/strategies", "daily", 0.5]] as typeof PAGES : []),
  ...(ACCOUNTS ? [["/pricing", "monthly", 0.3]] as typeof PAGES : []),
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map(([path, changeFrequency, priority]) => ({ url: `${SITE_URL}${path}`, changeFrequency, priority }));
}
