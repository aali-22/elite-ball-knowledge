import type { Metadata, Viewport } from "next";
import { Big_Shoulders, Geist, Geist_Mono, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import { SITE } from "@/lib/site";
import { THEME_SCRIPT } from "@/lib/themeScript";
import { Providers } from "./providers";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
// The Hybrid look (globals.css, html[data-look]): heavy condensed caps for display, a serif for matchup names, mono labels.
// Self-hosted at build by next/font, free.
// Not preloaded: the look's faces are used on the redesigned pages only, and a preload on every route is wasted bytes.
const serifDisplay = Instrument_Serif({ variable: "--font-instrument", subsets: ["latin"], weight: "400", style: ["normal"], preload: false, display: "swap" });
// next/font has no fallback metrics for Big Shoulders: a condensed stack (Impact on iOS and macOS, Arial Narrow on
// Windows) keeps the giant heading close to its final width while the file loads, so the page doesn't reflow.
const condensed = Big_Shoulders({ variable: "--font-shoulders", subsets: ["latin"], axes: ["opsz"], adjustFontFallback: false,
  fallback: ["Impact", "Arial Narrow", "Haettenschweiler", "sans-serif"], preload: false, display: "swap" });
const monoLabel = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"], preload: false, display: "swap" });

export const metadata: Metadata = {
  title: { default: `${SITE.name}: ${SITE.tagline}`, template: `%s · ${SITE.name}` },
  description: SITE.description,
  applicationName: SITE.name,
  appleWebApp: { capable: true, title: SITE.short, statusBarStyle: "black" },
  openGraph: { title: SITE.name, description: SITE.description, type: "website", siteName: SITE.name },
  twitter: { card: "summary", title: SITE.name, description: SITE.description },
  robots: { index: false, follow: false }, // until launch: nothing here is for a search engine yet
  referrer: "strict-origin-when-cross-origin",
};

// The head script (lib/themeScript.ts) sets the theme before the first paint and points theme-color at it; the server
// renders the default (dark) so a page with scripts off still reads.
export const viewport: Viewport = { themeColor: "#0b0b0b", colorScheme: "dark light" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // Extensions (LanguageTool, Grammarly, …) add attributes to <html>/<body> before React hydrates.
    // suppressHydrationWarning only ignores attribute mismatches on these two elements, not their children.
    // data-look: the Hybrid look on every page (the tokens live under html[data-look] in globals.css)
    <html lang="en" data-look="hybrid" className={`dark ${geistSans.variable} ${geistMono.variable} ${serifDisplay.variable} ${condensed.variable} ${monoLabel.variable}`} suppressHydrationWarning>
      <head>
        {/* a fixed string from lib/themeScript.ts, no user input */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
