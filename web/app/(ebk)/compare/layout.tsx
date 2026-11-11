import type { Metadata } from "next";

export const metadata: Metadata = { title: "Compare two teams", description: "Any two teams set against each other as if they met today." };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
