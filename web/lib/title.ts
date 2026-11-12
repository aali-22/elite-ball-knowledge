"use client";

import { useEffect } from "react";

/** A page's own tab title, for client pages that share a layout's metadata. */
export function usePageTitle(title: string | null | undefined) {
  useEffect(() => { if (title) document.title = `${title} · Elite Ball Knowledge`; }, [title]);
}
