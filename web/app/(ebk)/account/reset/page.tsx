import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ResetPassword } from "@/components/account/SignIn";
import { PageHeader } from "@/components/common/PageHeader";
import { ACCOUNTS } from "@/lib/site";

export const metadata: Metadata = { title: "New password", robots: { index: false, follow: false }, referrer: "no-referrer" };

// Where a password reset link lands: the link's one-time key arrives in the address and goes back with the new password.
export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  if (!ACCOUNTS) notFound();
  const key = (await searchParams).token;
  return (
    <main className="mx-auto grid max-w-3xl gap-8 px-4 py-6 sm:py-10">
      <PageHeader title="New password" size="sm" />
      {key ? <ResetPassword resetKey={key} /> : <p className="text-sm text-muted-foreground">This reset link is missing its key or has been used. Ask for a new one from the sign-in page.</p>}
    </main>
  );
}
