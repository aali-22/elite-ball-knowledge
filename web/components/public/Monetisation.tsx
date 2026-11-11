"use client";

// Ad and affiliate slots for the public view. Placeholders: they load nothing from any network (lib/publicConfig.ts).
import { ADS, AFFILIATES, type Affiliate } from "@/lib/publicConfig";

const SIZES = { banner: "min-h-[90px]", box: "min-h-[250px]", inline: "min-h-[100px]" };

export function AdSlot({ size = "inline", id }: { size?: keyof typeof SIZES; id: string }) {
  if (!ADS.showPlaceholders && !ADS.network) return null;
  return (
    <aside aria-label="Advertisement" data-ad-slot={id}
      className={`flex ${SIZES[size]} w-full items-center justify-center rounded-lg border border-dashed text-muted-foreground`}>
      <span className="pl-label">Ad · {id}</span>
    </aside>
  );
}

function AffiliateCard({ a }: { a: Affiliate }) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{a.name}</span>
        <span className="pl-label text-muted-foreground">Sponsored</span>
      </div>
      <p className="text-sm">{a.offer}</p>
      <p className="text-xs text-muted-foreground">{a.terms}</p>
    </>
  );
  const cls = "grid gap-1 rounded-lg border p-3";
  return a.url
    ? <a href={a.url} rel="sponsored noopener" target="_blank" className={`${cls} hover:border-foreground`}>{body}</a>
    : <div className={`${cls} border-dashed`} aria-disabled>{body}</div>;
}

/** The partner rail. Kept apart from every pick: an offer never sits inside a game card or next to a single pick. */
export function AffiliateRail() {
  if (!AFFILIATES.length) return null;
  return (
    <section aria-label="Sponsored offers" className="grid gap-2">
      <div className="pl-label text-muted-foreground">Partner offers</div>
      {AFFILIATES.map((a) => <AffiliateCard key={a.id} a={a} />)}
      <p className="text-xs leading-snug text-muted-foreground">
        We may earn a commission if you sign up through these links. It never changes which picks appear or how they are
        graded: picks come from the publishers named on each one.
      </p>
    </section>
  );
}
