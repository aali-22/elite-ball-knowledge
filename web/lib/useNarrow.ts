"use client";

import { useEffect, useState } from "react";

/** True on a phone-width screen (under Tailwind's `sm`). False on the server and the first paint. */
export function useNarrow(max = 639): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${max}px)`);
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [max]);
  return narrow;
}
