"use client";

// A load that failed is not a page that doesn't exist: it says so and offers the one thing that helps, trying again.
export function LoadError({ what, retry, className = "" }: { what: string; retry: () => void; className?: string }) {
  return (
    <div role="alert" className={`grid gap-3 rounded-3xl border border-dashed p-6 ${className}`}>
      <p className="pl-display text-3xl sm:text-4xl">Couldn&apos;t load {what}</p>
      <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">The numbers didn&apos;t arrive: a dropped connection or a busy server, not a missing page.</p>
      <button type="button" onClick={retry} className="pl-label min-h-11 justify-self-start rounded-full border px-5 hover:bg-muted">Try again</button>
    </div>
  );
}
