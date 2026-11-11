import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto grid min-h-[70dvh] max-w-3xl content-center gap-4 px-4 py-16">
      <p className="pl-label text-[var(--hot)]">404</p>
      <h1 className="pl-display text-[clamp(3rem,12vw,8rem)]">Out of bounds</h1>
      <p className="max-w-md text-sm leading-relaxed text-muted-foreground">That page doesn&apos;t exist, or the game it belonged to has left the slate.</p>
      <div className="flex flex-wrap gap-2">
        <Link href="/" className="pl-label rounded-full bg-[var(--hot)] px-5 py-3 text-[var(--hot-ink)]">Home</Link>
        <Link href="/games" className="pl-label rounded-full border px-5 py-3 hover:bg-muted">Tonight&apos;s games</Link>
      </div>
    </main>
  );
}
