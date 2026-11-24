import { ImageResponse } from "next/og";
import { SiteCard } from "@/lib/share-image";
import { SITE } from "@/lib/site";

// The card a link to the site shows when it is shared: drawn at build time, no image file. The drawing is the one a
// game link falls back to (lib/share-image), so the site's name is written in one place.
export const alt = `${SITE.name}: ${SITE.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(<SiteCard />, size);
}
