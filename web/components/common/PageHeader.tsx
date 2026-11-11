"use client";

// Every page's head in the Hybrid (H5): the title in giant condensed caps rising letter by letter, an optional eyebrow
// (a breadcrumb, a small label) in mono caps above it, and a hairline row under it with the page's one-sentence lede on
// the left and its controls on the right. Games & picks set the pattern; the other pages share this piece.
import { SplitHeading } from "@/components/motion/Reveal";

export function PageHeader({ title, eyebrow, lede, right, size = "md", children }: {
  title: string; eyebrow?: React.ReactNode; lede?: React.ReactNode; right?: React.ReactNode;
  size?: "lg" | "md" | "sm"; // lg: the section fronts (Games & picks); md: most pages; sm: deep pages with a breadcrumb
  children?: React.ReactNode; // anything else that belongs in the head (progress bars, legends, status lines)
}) {
  const sizes = { lg: "text-[clamp(3rem,14vw,11rem)]", md: "text-[clamp(2.6rem,9vw,6.5rem)]", sm: "text-[clamp(2rem,7vw,4rem)]" };
  return (
    <header className="grid gap-2 sm:gap-4">
      {eyebrow && <div className="pl-label flex flex-wrap items-center gap-2 text-muted-foreground">{eyebrow}</div>}
      <SplitHeading text={title} className={`pl-display ${sizes[size]}`} />
      {(lede || right) && (
        <div className="grid gap-2 border-t pt-3 sm:grid-cols-[1fr_auto] sm:items-end sm:gap-4 sm:pt-4">
          {lede ? <div className="max-w-2xl text-sm leading-snug text-muted-foreground sm:text-base [&_a]:underline [&_a]:decoration-[var(--hot)] [&_a]:decoration-2 [&_a]:underline-offset-4">{lede}</div> : <span />}
          {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
        </div>
      )}
      {children}
    </header>
  );
}
