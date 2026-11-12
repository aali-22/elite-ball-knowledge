"use client";

// Why a 30-team league reads "of 27": early in a season some teams are still on last season's numbers and are ranked
// among last season's teams. A data note (closed until asked for) wherever cards quote ranks, only while that is true.
import Link from "next/link";
import { useLeague } from "@/lib/ebk";
import { DataNote } from "./DataNote";

export function SeasonNote({ className = "" }: { className?: string }) {
  const q = useLeague("nba");
  const teams = q.data?.teams ?? [];
  const old = teams.filter((t) => t.carried);
  if (!old.length) return null;
  const now = teams.length - old.length;
  const names = old.map((t) => t.name).sort();
  const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names[0];
  return (
    <DataNote summary={`Why “of ${now}” in a ${teams.length}-team league`} className={className}>
      NBA ranks are among the {now} teams on this season&apos;s numbers. {list} {names.length > 1 ? "are" : "is"} still on last
      season&apos;s and {names.length > 1 ? "are" : "is"} ranked among last season&apos;s {teams.length}.{" "}
      <Link href="/models#rules" className="underline underline-offset-2">Which season, and why</Link>
    </DataNote>
  );
}
