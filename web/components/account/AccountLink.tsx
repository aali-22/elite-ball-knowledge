"use client";

// The bar's way into accounts: "Sign in" until the browser has heard it is signed in, then "Account". Drawn only
// where accounts are on (the bar checks lib/site ACCOUNTS).
import { User } from "lucide-react";
import Link from "next/link";
import { useEntitlement } from "@/lib/account";

export function AccountLink() {
  const label = useEntitlement().data?.signedIn ? "Account" : "Sign in";
  return (
    <Link href="/account" aria-label={label}
      className="inline-flex h-10 min-w-10 shrink-0 items-center justify-center gap-1.5 rounded-full border px-2.5 text-muted-foreground hover:text-foreground sm:h-8">
      <User aria-hidden className="size-3.5" /><span aria-hidden className="pl-label hidden text-[10px] sm:inline">{label}</span>
    </Link>
  );
}
