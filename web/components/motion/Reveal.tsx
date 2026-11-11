"use client";

// Motion pieces for the redesign: a block that rises in when it scrolls into view, and a heading that reveals letter by
// letter. Quick (≤ 400 ms) and off under the OS reduce-motion setting (MotionConfig reducedMotion="user" in providers;
// the heading's CSS keyframes check prefers-reduced-motion themselves).
import { m, useReducedMotion } from "framer-motion";

const EASE = [0.22, 1, 0.36, 1] as const;

export function Reveal({ children, delay = 0, className, as = "div", x = 0, y = 18 }: {
  children: React.ReactNode; delay?: number; className?: string; as?: "div" | "section" | "li"; x?: number; y?: number;
}) {
  const C = m[as];
  const still = useReducedMotion();
  if (still) {  // nothing starts hidden for a visitor who asked for less motion: the block is simply there
    const Plain = as;
    return <Plain className={className}>{children}</Plain>;
  }
  return (
    <C className={className} initial={{ opacity: 0, x, y }} whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -8% 0px" }} transition={{ duration: 0.38, delay: Math.min(delay, 0.3), ease: EASE }}>
      {children}
    </C>
  );
}

/** Each letter slides up from under a mask, staggered. CSS keyframes (globals.css .pl-rise), so the heading is on the
 * page before any script runs and the first paint already shows it rising; screen readers get the whole text once. */
export function SplitHeading({ text, className, as: Tag = "h1" }: { text: string; className?: string; as?: "h1" | "h2" }) {
  const chars = [...text];
  const step = Math.min(0.022, 0.3 / Math.max(chars.length, 1));
  return (
    <Tag className={className} aria-label={text}>
      {text.split(" ").map((word, wi, words) => {
        const before = words.slice(0, wi).join(" ").length + (wi ? 1 : 0);
        return (
          <span key={wi}>
            <span aria-hidden className="inline-block overflow-hidden whitespace-nowrap pb-[0.08em] align-bottom">
              {[...word].map((ch, ci) => (
                <span key={ci} className="pl-rise inline-block" style={{ animationDelay: `${((before + ci) * step).toFixed(3)}s` }}>{ch}</span>
              ))}
            </span>
            {wi < words.length - 1 && " "}
          </span>
        );
      })}
    </Tag>
  );
}
