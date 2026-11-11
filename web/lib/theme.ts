"use client";

// System / Light / Dark. The choice lives in localStorage ("picklab-theme"); THEME_SCRIPT runs in <head> before the
// first paint so the page never flashes the other theme, and useTheme keeps following the OS while on System.
// The app's default stays dark (dark-first, the theme it always had) until the owner picks something else.
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { THEME_DEFAULT, THEME_KEY, barColor, type ThemeChoice } from "./themeScript";

export type { ThemeChoice };

const read = (): ThemeChoice => {
  const c = typeof window === "undefined" ? null : localStorage.getItem(THEME_KEY);
  return c === "light" || c === "dark" || c === "system" ? c : THEME_DEFAULT;
};
const systemDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;

function apply(choice: ThemeChoice) {
  const dark = choice === "dark" || (choice === "system" && systemDark());
  const el = document.documentElement;
  el.classList.toggle("dark", dark);
  el.style.colorScheme = dark ? "dark" : "light";
  setBar();
}

/** Point the phone's status bar at the page's background. */
export function setBar() {
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", barColor(document.documentElement.classList.contains("dark")));
}

const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  const onStorage = (e: StorageEvent) => { if (e.key === THEME_KEY) { apply(read()); fn(); } }; // another tab changed it
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(fn); window.removeEventListener("storage", onStorage); };
};

const darkListeners = new Set<() => void>();
let darkObserver: MutationObserver | null = null;
const subscribeDark = (fn: () => void) => {
  darkListeners.add(fn);
  if (!darkObserver) {
    darkObserver = new MutationObserver(() => darkListeners.forEach((f) => f()));
    darkObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  }
  return () => {
    darkListeners.delete(fn);
    if (!darkListeners.size) { darkObserver?.disconnect(); darkObserver = null; }
  };
};
/** Whether the page is on the dark theme right now (the `dark` class on <html>); dark on the server, like the SSR default. */
export const useIsDark = () =>
  useSyncExternalStore(subscribeDark, () => document.documentElement.classList.contains("dark"), () => true);

/** [choice, set]. On "system" the page follows the OS live. */
export function useTheme(): [ThemeChoice, (next: ThemeChoice) => void] {
  const choice = useSyncExternalStore(subscribe, read, () => THEME_DEFAULT);
  useEffect(() => {
    apply(choice); // also fixes the theme-color meta if Next placed it after the head script ran
    if (choice !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const on = () => apply("system");
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [choice]);
  const set = useCallback((next: ThemeChoice) => {
    localStorage.setItem(THEME_KEY, next);
    apply(next);
    listeners.forEach((fn) => fn());
  }, []);
  return [choice, set];
}
