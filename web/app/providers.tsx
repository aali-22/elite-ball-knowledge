"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LazyMotion, MotionConfig, domAnimation } from "framer-motion";
import { useState } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, retry: 1 } } }),
  );
  return (
    <QueryClientProvider client={client}>
      {/* LazyMotion + domAnimation (no layout animations: tab underlines are CSS); "user" honours the OS reduce-motion
          setting everywhere. */}
      <LazyMotion features={domAnimation} strict>
        <MotionConfig reducedMotion="user">
          <TooltipProvider delay={150}>{children}</TooltipProvider>
        </MotionConfig>
      </LazyMotion>
    </QueryClientProvider>
  );
}
