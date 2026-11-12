"use client";

// Sources and method: where the numbers come from, whose picks are graded, and what the site leaves out and why.
import { PageHeader } from "@/components/common/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { usePublicSources, type PublicSources } from "@/lib/public";

const TIER: Record<string, { label: string; color: string }> = {
  own: { label: "Our own work", color: "var(--status-good)" },
  facts: { label: "Facts + link", color: "var(--status-warning)" },
  private: { label: "Not shown", color: "var(--viz-muted)" },
};

function PolicyTable({ rows, title }: { rows: PublicSources["sources"]; title: string }) {
  return (
    <section className="grid gap-2">
      <h2 className="pl-label text-muted-foreground">{title}</h2>
      <ul className="divide-y rounded-xl border">
        {rows.map((r) => (
          <li key={r.key} className="grid gap-1 p-3 sm:grid-cols-[200px_120px_1fr] sm:gap-4">
            <span className="font-medium">{r.name}</span>
            <span className="pl-label text-[10px]" style={{ color: TIER[r.tier]?.color }}>{TIER[r.tier]?.label ?? r.tier}</span>
            <span className="text-sm text-muted-foreground">
              {r.note}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function SourcesView() {
  const { data, isLoading } = usePublicSources();
  const picks = (data?.sources.length ?? 0) > 0;  // the PickLab rows exist only on a site that carries PickLab
  return (
    <main className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-6 sm:py-10">
      <PageHeader title="Sources" size="lg" eyebrow="Method and what we leave out"
        lede={`Analytics are computed from public box scores and play-by-play.${picks ? " Picks come from free articles: we show who picked what, at which line and price, and link to the article for the reasoning. Results and records are our own grading." : " Nothing here is bought, licensed or behind a paywall, and no betting price is used anywhere."}`} />
      {isLoading && <Skeleton className="h-64 rounded-xl" />}
      {data && (
        <>
          <PolicyTable title="Where the analytics come from" rows={data.data ?? []} />
          {picks && <PolicyTable title="Whose picks are graded" rows={data.sources} />}
          {data.strategies.length > 0 && <PolicyTable title="Our strategies" rows={data.strategies} />}
          {data.excluded.length > 0 && <section className="grid gap-2">
            <h2 className="pl-label text-muted-foreground">Never on this site</h2>
            <ul className="divide-y rounded-xl border">
              {data.excluded.map((x) => (
                <li key={x.what} className="grid gap-1 p-3 sm:grid-cols-[320px_1fr] sm:gap-4">
                  <span className="font-medium">{x.what}</span><span className="text-sm text-muted-foreground">{x.why}</span>
                </li>
              ))}
            </ul>
          </section>}
        </>
      )}
    </main>
  );
}
