"use client";

// The current theme (the `dark` class on <html>) and team colours inked for it (lib/teamInk). Follows class changes, so a
// theme toggle or a screenshot script that flips the class re-inks every team colour without a reload.
import { useCallback, useSyncExternalStore } from "react";
import { onInk, teamInk, type Theme } from "./teamInk";

function subscribe(cb: () => void) {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => mo.disconnect();
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe,
    () => (document.documentElement.classList.contains("dark") ? "dark" : "light"),
    () => "dark"); // the server renders the app's default theme
}

/** `text(hex)` for a team colour used as text (4.5:1), `mark(hex)` for a bar, dot or border (3:1), `on(fill)` for text
 *  placed on a filled mark. */
export function useTeamInk() {
  const theme = useTheme();
  const text = useCallback((hex: string | null | undefined) => teamInk(hex, theme, "text"), [theme]);
  const mark = useCallback((hex: string | null | undefined) => teamInk(hex, theme, "mark"), [theme]);
  return { theme, text, mark, on: onInk };
}
