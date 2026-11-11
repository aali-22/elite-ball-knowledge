"use client";

// Any page that throws while rendering lands here instead of a blank screen. The message is ours, never the error's.
import Link from "next/link";
import { useEffect } from "react";

export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <main className="mx-auto grid min-h-[70dvh] max-w-3xl content-center gap-4 px-4 py-16">
      <p className="pl-label text-[var(--hot)]">Something broke</p>
      <h1 className="pl-display text-[clamp(3rem,12vw,8rem)]">Whistle blown</h1>
      <p className="max-w-md text-sm leading-relaxed text-muted-foreground">This page hit an error while drawing. Trying again usually fixes it.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={reset} className="pl-label rounded-full bg-[var(--hot)] px-5 py-3 text-[var(--hot-ink)]">Try again</button>
        <Link href="/" className="pl-label rounded-full border px-5 py-3 hover:bg-muted">Home</Link>
      </div>
    </main>
  );
}
