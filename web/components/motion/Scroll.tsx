"use client";

// Scroll-driven motion for the public site. All of it is decoration on top of content that is already on the page:
// under the OS reduce-motion setting (MotionConfig reducedMotion="user") transforms are skipped and everything reads
// the same. Quick and eased, no bounce.
import { m, useInView, useScroll, useSpring, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";

/** A hairline along the top of the window that fills as the page is read. */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const x = useSpring(scrollYProgress, { stiffness: 220, damping: 36, mass: 0.4 });
  return <m.div aria-hidden className="fixed inset-x-0 top-0 z-50 h-0.5 origin-left bg-[var(--hot)]" style={{ scaleX: x }} />;
}

/** Children drift against the scroll while their box crosses the window (a slow layer behind a heading). */
export function Parallax({ children, amount = 60, className }: { children: React.ReactNode; amount?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [amount, -amount]);
  return <div ref={ref} className={className}><m.div style={{ y }} className="h-full">{children}</m.div></div>;
}

/** True once the element has scrolled into view (and stays true): charts draw themselves in on it. */
export function useSeen<T extends Element>(margin: `${number}px` | `${number}%` = "-12%") {
  const ref = useRef<T>(null);
  const seen = useInView(ref, { once: true, margin: `0px 0px ${margin} 0px` });
  return [ref, seen] as const;
}

/** A block whose child draws in when seen: `children(seen)`. */
export function Seen({ children, className }: { children: (seen: boolean) => React.ReactNode; className?: string }) {
  const [ref, seen] = useSeen<HTMLDivElement>();
  return <div ref={ref} className={className}>{children(seen)}</div>;
}

/**
 * Scrollytelling: the visual stays pinned while the steps scroll past it; `visual(i)` draws the step in view.
 * On a phone the visual pins to the top half and the steps pass under it. Without scripts every step is still there.
 */
export function ScrollScene<T>({ steps, visual, step, className = "" }: {
  steps: T[]; visual: (active: number) => React.ReactNode; step: (s: T, i: number, active: boolean) => React.ReactNode; className?: string;
}) {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLLIElement | null)[]>([]);
  useEffect(() => {
    const io = new IntersectionObserver((es) => {
      for (const e of es) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.i));
    }, { rootMargin: "-45% 0px -45% 0px" });
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [steps.length]);
  return (
    <div className={`grid gap-x-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] ${className}`}>
      <div className="sticky top-12 z-10 order-first h-[44svh] self-start bg-background/95 py-3 backdrop-blur lg:order-last lg:top-20 lg:h-[calc(100svh-7rem)] lg:bg-transparent lg:py-0 lg:backdrop-blur-none">
        <div className="grid h-full place-items-center">{visual(active)}</div>
      </div>
      <ol className="grid">
        {steps.map((s, i) => (
          <li key={i} data-i={i} ref={(el) => { refs.current[i] = el; }} aria-current={i === active ? "step" : undefined}
            className={`flex min-h-[62svh] items-center transition-opacity duration-300 lg:min-h-[64svh] ${i === active ? "opacity-100" : "opacity-35"}`}>
            {step(s, i, i === active)}
          </li>
        ))}
      </ol>
    </div>
  );
}
