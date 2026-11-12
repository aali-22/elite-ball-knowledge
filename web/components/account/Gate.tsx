"use client";

// A paid feature in a page. <Gate feature="export.csv">…</Gate> draws its children for anyone the feature is open
// to (everyone while the paywall is off), a one-line pointer to the plans for anyone else, and nothing at all on a
// site without accounts. The server checks again wherever the feature is served (lib/server/entitlement `can`):
// this only decides what to draw.
import { Lock } from "lucide-react";
import Link from "next/link";
import { useEntitlement } from "@/lib/account";
import { FEATURES, type Feature } from "@/lib/plans";
import { ACCOUNTS } from "@/lib/site";

export function Upsell({ feature }: { feature: Feature }) {
  return (
    <p className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
      <Lock aria-hidden className="size-4" />
      <span>{FEATURES[feature].label} is part of Pro.</span>
      <Link href="/pricing" className="underline decoration-[var(--hot)] decoration-2 underline-offset-4 hover:text-foreground">See plans</Link>
    </p>
  );
}

export function Gate({ feature, children, fallback }: { feature: Feature; children: React.ReactNode; fallback?: React.ReactNode }) {
  const me = useEntitlement();
  if (!ACCOUNTS || !me.data) return null;
  if (me.data.features[feature]) return <>{children}</>;
  return <>{fallback === undefined ? <Upsell feature={feature} /> : fallback}</>;
}
