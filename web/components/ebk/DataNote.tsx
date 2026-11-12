// A nuance kept one tap away. The page states its finding; how a number was counted, which season it is from or why
// two readings differ is a data note: there for the reader who wants it, closed for the one who doesn't. A native
// disclosure, so it works before any script runs.
import { ChevronDown, Info } from "lucide-react";

export function DataNote({ summary, children, className = "" }: { summary: string; children: React.ReactNode; className?: string }) {
  return (
    <details className={`group ${className}`}>
      <summary className="pl-label inline-flex min-h-9 cursor-pointer list-none items-center gap-1.5 rounded-full border px-3 text-[10px] text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
        <Info aria-hidden className="size-3.5" />
        <span><span className="sr-only">Data note: </span>{summary}</span>
        <ChevronDown aria-hidden className="size-3.5 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
      </summary>
      <div className="mt-2 max-w-3xl text-xs leading-relaxed text-muted-foreground">{children}</div>
    </details>
  );
}
