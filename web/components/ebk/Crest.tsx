"use client";

// A team's crest and a player's face. The image when there is one, else a drawn monogram in the side's colour, in the
// same fixed box, so a missing or blocked image never moves the layout. Decoration: the name is always beside it.
import { useState } from "react";
import { headshot, initials, teamLogo } from "@/lib/teamMedia";
import { useIsDark } from "@/lib/theme";

function Mono({ text, color, round = false }: { text: string; color?: string; round?: boolean }) {
  return (
    <span aria-hidden className={`inline-flex shrink-0 items-center justify-center font-bold leading-none ${round ? "rounded-full" : "rounded-[22%]"}`}
      style={{ width: "100%", height: "100%", fontSize: `${text.length > 3 ? 24 : 32}cqw`, color: color ?? "var(--foreground)",
        background: `color-mix(in oklab, ${color ?? "var(--foreground)"} 16%, transparent)`, boxShadow: `inset 0 0 0 1.5px color-mix(in oklab, ${color ?? "var(--foreground)"} 45%, transparent)` }}>
      {text}
    </span>
  );
}

export function Crest({ sport, team, name, size = 40, color, className = "", style, eager = false }: {
  sport: string; team: string; name: string; size?: number; color?: string; className?: string; style?: React.CSSProperties; eager?: boolean;
}) {
  const dark = useIsDark();
  const [failed, setFailed] = useState(false);
  const src = teamLogo(sport, team, dark);
  const code = team.startsWith("soc") ? undefined : team;
  return (
    <span className={`inline-flex shrink-0 [container-type:size] ${className}`} style={{ width: size, height: size, ...style }}>
      {src && !failed
        // eslint-disable-next-line @next/next/no-img-element -- a remote, decorative mark in a fixed box
        ? <img src={src} alt="" title={name} width={size} height={size} draggable={false} referrerPolicy="no-referrer" loading={eager ? "eager" : "lazy"}
            decoding="async" onError={() => setFailed(true)} className="size-full object-contain drop-shadow-sm" />
        : <Mono text={initials(name, code)} color={color} />}
    </span>
  );
}

export function Face({ playerId, name, size = 48, color, className = "" }: { playerId: string; name: string; size?: number; color?: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const src = headshot(playerId);
  return (
    <span className={`inline-flex shrink-0 overflow-hidden rounded-full bg-muted [container-type:size] ${className}`} style={{ width: size, height: size }}>
      {src && !failed
        // eslint-disable-next-line @next/next/no-img-element -- a remote, decorative photo in a fixed box
        ? <img src={src} alt="" title={name} width={size} height={size} draggable={false} referrerPolicy="no-referrer" loading="lazy" decoding="async"
            onError={() => setFailed(true)} className="size-full object-cover object-top" />
        : <Mono text={initials(name)} color={color} round />}
    </span>
  );
}
