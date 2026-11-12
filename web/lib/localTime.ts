"use client";

// Dates and times that read the same on the server and in the browser. The server can't know a visitor's time zone
// or language, so the first render (the server's, and the browser's while it takes the page over) writes every time
// in US Eastern, the leagues' own clock, in US English. The moment the page is live React draws those components
// again with `local` true, and the times switch to the visitor's own zone and language.
import { useSyncExternalStore } from "react";

const never = () => () => {};

/** False on the server and while the browser takes the server's page over; true from then on, and on every page
 *  reached by a link. A component that prints a date calls this and passes the answer to the formatters below. */
export const useLocalTime = () => useSyncExternalStore(never, () => true, () => false);
/** The same switch under its general name: is this component live in the browser yet? */
export const useHydrated = useLocalTime;

const place = (local: boolean) => (local ? {} : { timeZone: "America/New_York" });
const lang = (local: boolean) => (local ? undefined : "en-US");

export const fmtDate = (d: Date | string, opts: Intl.DateTimeFormatOptions, local: boolean) => new Date(d).toLocaleDateString(lang(local), { ...opts, ...place(local) });
export const fmtTime = (d: Date | string, opts: Intl.DateTimeFormatOptions, local: boolean) => new Date(d).toLocaleTimeString(lang(local), { ...opts, ...place(local) });
export const fmtDateTime = (d: Date | string, opts: Intl.DateTimeFormatOptions, local: boolean) => new Date(d).toLocaleString(lang(local), { ...opts, ...place(local) });
/** A whole number with thousands separators, the same everywhere (the site is written in English). */
export const fmtInt = (n: number) => n.toLocaleString("en-US");
