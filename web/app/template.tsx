"use client";

// The app-wide page transition (H4): a short fade on every route change, no movement, off under reduce-motion.
import { m } from "framer-motion";

export default function Template({ children }: { children: React.ReactNode }) {
  return <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}>{children}</m.div>;
}
