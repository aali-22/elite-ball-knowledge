import type { Metadata } from "next";

export const metadata: Metadata = { title: "Our record · PickLab", description: "The site's own paper strategies, graded like everyone else's, beside control strategies." };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
