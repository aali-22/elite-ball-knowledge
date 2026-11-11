import { SiteFooter, SiteNav } from "@/components/common/SiteNav";
import { ScrollProgress } from "@/components/motion/Scroll";

// The public site (Elite Ball Knowledge): its own bar and footer around every page in this group.
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <ScrollProgress />
      <SiteNav />
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </div>
  );
}
