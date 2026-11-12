// Shared by the root layout (server) and lib/theme.ts (client): no "use client" here, so the layout gets the string.
export type ThemeChoice = "system" | "light" | "dark";
export const THEME_KEY = "picklab-theme";
export const THEME_DEFAULT: ThemeChoice = "system"; // a first visit follows the device's own light or dark setting
// Matches --background in globals.css (the Hybrid look's bone / near-black, on every page since H5): the phone's status
// bar takes this colour.
export const BAR = { light: "#e6e4dc", dark: "#0b0b0b" };
export const barColor = (dark: boolean) => (dark ? BAR.dark : BAR.light);

/** Inline, blocking: keep in sync with apply() in theme.ts (it can't import anything). */
export const THEME_SCRIPT = `(function(){try{var c=localStorage.getItem("${THEME_KEY}");if(c!=="light"&&c!=="dark"&&c!=="system")c="${THEME_DEFAULT}";
var d=c==="dark"||(c==="system"&&matchMedia("(prefers-color-scheme: dark)").matches),e=document.documentElement;
e.classList.toggle("dark",d);e.style.colorScheme=d?"dark":"light";
var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",d?"${BAR.dark}":"${BAR.light}");}catch(_){}})();`;

