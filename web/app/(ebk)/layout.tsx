import { SiteFooter, SiteNav } from "@/components/common/SiteNav";
import { Shell } from "@/components/ebk/Shell";
import { ScrollProgress } from "@/components/motion/Scroll";

// The public site (Elite Ball Knowledge): its own bar and footer around every page in this group, inside the shell
// that gives every page search, themed controls and page changes that carry shared elements across.
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <Shell>
      <div className="flex min-h-dvh flex-col">
        <ScrollProgress />
        <SiteNav />
        <div id="main" className="flex-1 scroll-mt-14">{children}</div>
        <SiteFooter />
      </div>
    </Shell>
  );
}
