import { SITE_HOST } from "@/lib/site";

/** The site's address in small type at the foot of a finding: a card gets screenshotted and passed on without its
 *  link, and this is what says where it came from. Nothing but text. */
export function SiteMark({ className = "" }: { className?: string }) {
  if (!SITE_HOST) return null;
  return <span data-site-mark className={`pl-label text-[9px] normal-case tracking-wide text-muted-foreground ${className}`}>{SITE_HOST}</span>;
}
