"use client";

// A horizontal strip of cards (the Brandon Yasin row): native swipe on the phone, snap to each card, drag with the
// mouse on desktop, ← → buttons and the arrow keys, a thin progress bar under it, and the edge with more cards fades.
// Items are the caller's own elements; give each `snap-start shrink-0` and a width.
import { m, useScroll } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState } from "react";
import { edgeMask, useScrollEdges } from "@/components/common/ScrollRow";

export function Strip({ label, children, className = "", tail, bleed = true, rowRole, rowLabel, onRowKeyDown }: {
  label: string; children: React.ReactNode; className?: string;
  tail?: React.ReactNode; // next to the arrows (a count, a link)
  bleed?: boolean; // run to the page edge on the phone
  rowRole?: string; rowLabel?: string; onRowKeyDown?: React.KeyboardEventHandler<HTMLElement>; // the items as a radiogroup
}) {
  const ref = useRef<HTMLDivElement>(null);
  const edge = useScrollEdges(ref);
  const { scrollXProgress } = useScroll({ container: ref });
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  const [dragging, setDragging] = useState(false);
  const by = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: "smooth" });
  const end = () => {
    if (!drag.current) return;
    setDragging(false);
    if (!drag.current.moved) drag.current = null; // a plain click: let it through; a drag is cleared by the click that ends it
    else setTimeout(() => { drag.current = null; }, 0); // no click follows a drag that ended off the strip (cancel / capture lost)
  };
  const scrolls = edge.left || edge.right;
  const mask = edgeMask(edge, 16);

  return (
    <div className="grid min-w-0 gap-2">
      <div ref={ref} role="region" aria-roledescription="carousel" aria-label={label} tabIndex={0}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) { onRowKeyDown?.(e); return; }
          if (e.key === "ArrowRight") { e.preventDefault(); by(1); }
          if (e.key === "ArrowLeft") { e.preventDefault(); by(-1); }
        }}
        onPointerDown={(e) => {
          if (e.pointerType !== "mouse" || e.button !== 0) return;
          drag.current = { x: e.clientX, left: ref.current!.scrollLeft, moved: false };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d || !(e.buttons & 1)) return;
          const dx = e.clientX - d.x;
          if (!d.moved && Math.abs(dx) < 6) return;
          if (!d.moved) { d.moved = true; setDragging(true); ref.current!.setPointerCapture(e.pointerId); } // the drag follows the mouse past links and the strip's edge
          ref.current!.scrollLeft = d.left - dx;
        }}
        onPointerUp={end}
        onPointerCancel={end}
        onLostPointerCapture={end}
        onDragStart={(e) => { if (drag.current) e.preventDefault(); }} // no native link / image drag while the strip is dragged
        onClickCapture={(e) => {
          // a drag ends on a card: don't open it (a keyboard click has no pointer and passes)
          if (drag.current?.moved && e.detail > 0) { e.preventDefault(); e.stopPropagation(); }
          drag.current = null;
        }}
        className={`-my-1.5 flex min-w-0 gap-3 overflow-x-auto overscroll-x-contain py-1.5 outline-none [scrollbar-width:none] focus-visible:ring-2 focus-visible:ring-[var(--hot)] [&::-webkit-scrollbar]:hidden ${
          dragging ? "cursor-grabbing select-none snap-none" : "snap-x snap-mandatory scroll-smooth md:cursor-grab"} ${
          bleed ? "-mx-4 scroll-px-4 px-4 sm:mx-0 sm:scroll-px-0 sm:px-0" : ""} ${className}`}
        style={{ maskImage: mask, WebkitMaskImage: mask }}>
        {rowRole ? <div role={rowRole} aria-label={rowLabel} className="contents">{children}</div> : children}
      </div>
      {(scrolls || tail) && (
        <div className="flex items-center gap-3">
          <div className="relative h-px flex-1 overflow-hidden bg-border" aria-hidden>
            {scrolls && <m.div className="absolute inset-0 origin-left bg-[var(--hot,var(--foreground))]" style={{ scaleX: scrollXProgress }} />}
          </div>
          {tail}
          {scrolls && (
            <div className="hidden items-center gap-1 sm:flex">
              <button type="button" onClick={() => by(-1)} disabled={!edge.left} aria-label={`Back: ${label}`}
                className="inline-flex size-10 items-center justify-center rounded-full border sm:size-8 text-muted-foreground transition hover:border-foreground/40 hover:text-foreground disabled:opacity-30">
                <ChevronLeft className="size-4" />
              </button>
              <button type="button" onClick={() => by(1)} disabled={!edge.right} aria-label={`More: ${label}`}
                className="inline-flex size-10 items-center justify-center rounded-full border sm:size-8 text-muted-foreground transition hover:border-foreground/40 hover:text-foreground disabled:opacity-30">
                <ChevronRight className="size-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
