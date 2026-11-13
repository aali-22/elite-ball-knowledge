// Structured data for search engines: one JSON-LD block, written by the server. It states what a page is (the site, a
// game and its two teams, where the page sits), never a result or a forecast. "<" is escaped so no value can close the
// script element it sits in.
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

/** A page's place in the site, outermost first: [name, path] pairs under `site` (the site's address, no trailing slash). */
export function crumbs(site: string, trail: [string, string][]): Record<string, unknown> {
  return {
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: trail.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: `${site}${path}` })),
  };
}
