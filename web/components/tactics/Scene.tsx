"use client";

// The animated bird's-eye drawing of one matchup: a fixed choreography per mechanism (scenes.tsx), ending the way the
// computed edge leans. An illustration, never a replay of a real play.
import { Pause, Play, RotateCcw, SkipBack, SkipForward } from "lucide-react";
import { teamInk } from "@/lib/teamInk";
import { useTeamInk } from "@/lib/useTeamInk";
import { useClock } from "./fields";
import { SCENES } from "./scenes";

export type Side = { code: string; name: string; color: string };
type MatchupEdge = { scene: string; label: string; attack_team: string; edge: number; confidence: number };

export function Scene({ edge, home, away }: { edge: MatchupEdge; home: Side; away: Side }) {
  const clock = useClock(4800);
  const atk = edge.attack_team === home.code ? home : away;
  const def = atk === home ? away : home;
  const View = SCENES[edge.scene];
  const { text } = useTeamInk();
  // The field is dark green in both themes, so players take the dark-theme mark ink whatever the page theme.
  const onField = (hex: string) => teamInk(hex, "dark", "mark");
  const same = atk.color.toLowerCase() === def.color.toLowerCase(); // no team colours (NBA today): blue attack, red defense
  return (
    <figure className="mx-auto grid w-full max-w-3xl gap-2">
      <div className="overflow-hidden rounded-lg border border-border">
        {View ? <View t={clock.t} win={edge.edge >= 0} a={same ? "#60a5fa" : onField(atk.color)} d={same ? "#f87171" : onField(def.color)} aLabel={atk.name} dLabel={def.name} />
          : <p className="p-4 text-xs text-muted-foreground">No drawing for this matchup yet.</p>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <figcaption className="min-w-0 text-xs">
          <b>{edge.label}</b> · <span style={{ color: text(atk.color) }} className="font-semibold">{atk.name}</span> with the ball ·{" "}
          {edge.edge >= 0 ? `${atk.name} have the better of it` : `${def.name} have the better of it`} ({edge.edge >= 0 ? "+" : ""}{edge.edge.toFixed(2)}, confidence {Math.round(edge.confidence * 100)}%)
        </figcaption>
        <div className="flex shrink-0 gap-1" role="group" aria-label="Animation controls">
          <button className="rounded border border-border p-1" aria-label="Back" onClick={() => clock.step(-0.1)}><SkipBack className="size-3.5" /></button>
          <button className="rounded border border-border p-1" aria-label={clock.playing ? "Pause" : "Play"} onClick={clock.toggle}>
            {clock.playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}</button>
          <button className="rounded border border-border p-1" aria-label="Forward" onClick={() => clock.step(0.1)}><SkipForward className="size-3.5" /></button>
          <button className="rounded border border-border p-1" aria-label="Replay" onClick={clock.restart}><RotateCcw className="size-3.5" /></button>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">An illustration of the mechanism, ending the way the numbers lean. Not a replay of a real play.</p>
    </figure>
  );
}
