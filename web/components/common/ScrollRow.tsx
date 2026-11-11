"use client";

// A row that scrolls sideways instead of wrapping or clipping (tab bars, chip rows on the phone). The edge that has more
// content fades out, so it's clear there is more to swipe to; no fade when everything fits.
import { useEffect, useRef, useState, type RefObject } from "react";

/** Which edges of a sideways-scrolling element have more content past them (kept current on scroll and resize). */
export function useScrollEdges(ref: RefObject<HTMLElement | null>) {
  const [edge, setEdge] = useState({ left: false, right: false });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const next = { left: el.scrollLeft > 2, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 2 };
      setEdge((cur) => (cur.left === next.left && cur.right === next.right ? cur : next)); // same object: no re-render per scroll frame
    };
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    for (const c of el.children) ro.observe(c);
    // cards that arrive after mount (sports once GET /sports answers, pickers once the feed does) must be measured too
    const mo = new MutationObserver((muts) => {
      for (const m of muts) for (const n of m.addedNodes) if (n instanceof Element) ro.observe(n);
      measure();
    });
    mo.observe(el, { childList: true });
    return () => { el.removeEventListener("scroll", measure); ro.disconnect(); mo.disconnect(); };
  }, [ref]);
  return edge;
}

/** The mask that fades the edges with more content (none when everything fits). */
export function edgeMask(edge: { left: boolean; right: boolean }, px = 24) {
  const fade = (on: boolean) => (on ? `transparent, #000 ${px}px` : "#000, #000");
  return edge.left || edge.right
    ? `linear-gradient(to right, ${fade(edge.left)}, #000 calc(100% - ${px}px), ${edge.right ? "transparent" : "#000"})` : undefined;
}

export function ScrollRow({ className = "", children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null);
  const edge = useScrollEdges(ref);
  const mask = edgeMask(edge);
  return (
    <div ref={ref} {...rest} data-scroll-edges={`${edge.left ? "l" : ""}${edge.right ? "r" : ""}`}
      className={`flex min-w-0 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
      style={{ maskImage: mask, WebkitMaskImage: mask, ...rest.style }}>
      {children}
    </div>
  );
}
