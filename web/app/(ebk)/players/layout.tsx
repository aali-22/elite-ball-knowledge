import type { Metadata } from "next";

export const metadata: Metadata = { title: "Player", description: "A player's production ranked at the position, against recent opponents." };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
