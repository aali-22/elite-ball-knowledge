import type { MetadataRoute } from "next";
import { ACCOUNTS, INDEXABLE, SITE_URL } from "@/lib/site";

// Nothing is crawlable until the site is launched (NEXT_PUBLIC_INDEXABLE=1); the API and any local workspace never are.
export default function robots(): MetadataRoute.Robots {
  if (!INDEXABLE) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/lab/", ...(ACCOUNTS ? ["/account"] : [])] }], sitemap: `${SITE_URL}/sitemap.xml` };
}
