import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: "Page not found" };

// Any address the site has no page for lands here, so the "not found" page keeps the site's bar, search and footer.
export default function Unknown() {
  notFound();
}
