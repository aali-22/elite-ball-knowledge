// Where to go from the end of a page: two or three plain links, so no page is a dead end. No script: works as HTML.
import { ArrowRight } from "lucide-react";
import Link from "next/link";

export function Onward({ links, className = "" }: { links: { href: string; label: string }[]; className?: string }) {
  return (
    <nav aria-label="Where next" data-onward className={`flex flex-wrap gap-2 border-t pt-5 ${className}`}>
      {links.map((l) => (
        <Link key={l.href} href={l.href} className="pl-label group inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-[11px] hover:border-foreground/50 hover:bg-muted/60">
          {l.label}<ArrowRight aria-hidden className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none" />
        </Link>
      ))}
    </nav>
  );
}
