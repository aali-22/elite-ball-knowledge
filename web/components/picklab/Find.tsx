"use client";

// The search box at the top of PickLab's lists: a team, a player or an analyst, across every day PickLab holds.
import { Search, X } from "lucide-react";

export function Find({ value, onChange }: { value: string; onChange: (q: string) => void }) {
  return (
    <label className="relative flex min-w-0 flex-1 items-center sm:max-w-xs">
      <span className="sr-only">Find a team, a player or an analyst</span>
      <Search aria-hidden className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder="Find a team, player or analyst" autoComplete="off" spellCheck={false}
        className="h-10 w-full rounded-full border bg-transparent pl-9 pr-9 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-foreground [&::-webkit-search-cancel-button]:hidden" />
      {value && (
        <button type="button" aria-label="Clear the search" onClick={() => onChange("")} className="absolute right-1 inline-flex size-8 items-center justify-center rounded-full text-muted-foreground hover:text-foreground">
          <X aria-hidden className="size-4" />
        </button>
      )}
    </label>
  );
}
