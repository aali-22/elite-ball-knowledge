"use client";

// Signing in and making an account. Each button is a fetch followed by a full page load; nothing here is a native
// form post (the fields carry no `name`, so even a submit before the page is live sends nothing).
import { useState } from "react";
import { Picker } from "@/components/ebk/Controls";
import { auth, go } from "@/lib/account";

const FIELD = "h-11 w-full rounded-xl border bg-transparent px-3 text-base outline-none focus-visible:border-foreground";
const PRIMARY = "pl-label min-h-11 rounded-full bg-[var(--hot)] px-5 text-[var(--hot-ink)] disabled:opacity-50";
const QUIET = "pl-label min-h-11 rounded-full border px-5 hover:bg-muted disabled:opacity-50";
type Mode = "in" | "new" | "forgot";

export function SignIn({ google, resetLinks }: { google: boolean; resetLinks: boolean }) {
  const [mode, setMode] = useState<Mode>("in");
  const [email, setEmail] = useState(""), [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [note, setNote] = useState<string | null>(null);

  const run = async (work: () => Promise<void>) => {
    setBusy(true); setError(null); setNote(null);
    try { await work(); } catch (e) { setError(e instanceof Error ? e.message : "That didn't work. Try again."); setBusy(false); }
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      if (mode === "forgot") {
        await auth("/request-password-reset", { email, redirectTo: "/account/reset" });
        setNote("If that address has an account, its reset link is in this machine's server log."); setBusy(false);
        return;
      }
      await auth(mode === "in" ? "/sign-in/email" : "/sign-up/email", mode === "in" ? { email, password } : { email, password, name: email.split("@")[0] });
      go("/account");
    });
  };

  return (
    <section className="grid max-w-md gap-5 rounded-3xl border bg-card p-5 sm:p-6">
      {mode !== "forgot" && <Picker label="Sign in or create an account" value={mode} onChange={(m) => { setMode(m); setError(null); }}
        options={[{ value: "in", label: "Sign in" }, { value: "new", label: "Create account" }]} />}
      <form onSubmit={submit} className="grid gap-3">
        <label className="grid gap-1"><span className="pl-label text-[10px] text-muted-foreground">Email</span>
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={FIELD} /></label>
        {mode !== "forgot" && (
          <label className="grid gap-1"><span className="pl-label text-[10px] text-muted-foreground">Password{mode === "new" ? " · 10 characters or more" : ""}</span>
            <input type="password" required minLength={mode === "new" ? 10 : undefined} autoComplete={mode === "new" ? "new-password" : "current-password"}
              value={password} onChange={(e) => setPassword(e.target.value)} className={FIELD} /></label>
        )}
        {error && <p role="alert" className="text-sm text-[var(--hot)]">{error}</p>}
        {note && <p role="status" className="text-sm text-muted-foreground">{note}</p>}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button type="submit" disabled={busy} className={PRIMARY}>{mode === "in" ? "Sign in" : mode === "new" ? "Create account" : "Get a reset link"}</button>
          {mode === "in" && resetLinks && <button type="button" onClick={() => { setMode("forgot"); setError(null); }} className="text-sm text-muted-foreground underline underline-offset-4">Forgot password</button>}
          {mode === "forgot" && <button type="button" onClick={() => { setMode("in"); setNote(null); }} className="text-sm text-muted-foreground underline underline-offset-4">Back to sign in</button>}
        </div>
      </form>
      {google && mode !== "forgot" && (
        <button type="button" disabled={busy} className={`${QUIET} justify-self-start`}
          onClick={() => run(async () => go((await auth<{ url: string }>("/sign-in/social", { provider: "google", callbackURL: "/account", disableRedirect: true })).url))}>
          Continue with Google
        </button>
      )}
    </section>
  );
}

export function ResetPassword({ resetKey }: { resetKey: string }) {
  const [password, setPassword] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError(null);
    try { await auth("/reset-password", { newPassword: password, token: resetKey }); go("/account"); }
    catch (err) { setError(err instanceof Error ? err.message : "That didn't work. Try again."); setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="grid max-w-md gap-3 rounded-3xl border bg-card p-5 sm:p-6">
      <label className="grid gap-1"><span className="pl-label text-[10px] text-muted-foreground">New password · 10 characters or more</span>
        <input type="password" required minLength={10} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={FIELD} /></label>
      {error && <p role="alert" className="text-sm text-[var(--hot)]">{error}</p>}
      <button type="submit" disabled={busy} className={`${PRIMARY} justify-self-start`}>Save and sign in</button>
    </form>
  );
}
