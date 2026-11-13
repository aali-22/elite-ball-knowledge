import type { Metadata, Viewport } from "next";
import { Big_Shoulders, Geist, Geist_Mono, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import { AnalyticsNotice } from "@/components/common/AnalyticsNotice";
import { JsonLd } from "@/components/common/JsonLd";
import { GSC_VERIFICATION, INDEXABLE, SITE, SITE_URL } from "@/lib/site";
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
  openGraph: { title: SITE.name, description: SITE.description, type: "website", siteName: SITE.name, url: "/" },
  twitter: { card: "summary_large_image", title: SITE.name, description: SITE.description },
  metadataBase: new URL(SITE_URL),
  // "./" is each page's own address: a fixed "/" here would be inherited by every page without its own canonical and
  // tell search engines the whole site is a copy of the home page
  alternates: { canonical: "./" },
  robots: INDEXABLE ? { index: true, follow: true } : { index: false, follow: false }, // off until NEXT_PUBLIC_INDEXABLE=1
  referrer: "strict-origin-when-cross-origin",
  // Search Console's ownership tag, only when the owner has set its code (NEXT_PUBLIC_GSC_VERIFICATION)
  ...(GSC_VERIFICATION ? { verification: { google: GSC_VERIFICATION } } : {}),
};

// What the site is, for search engines: the site and who publishes it. No claim beyond the name and the description.
const SITE_LD = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "WebSite", "@id": `${SITE_URL}/#site`, url: `${SITE_URL}/`, name: SITE.name, alternateName: SITE.short, description: SITE.description, inLanguage: "en", publisher: { "@id": `${SITE_URL}/#org` } },
    { "@type": "Organization", "@id": `${SITE_URL}/#org`, name: SITE.name, url: `${SITE_URL}/`, logo: `${SITE_URL}/icon/512` },
  ],
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
        <JsonLd data={SITE_LD} />
        {/* draws nothing unless analytics is on (NEXT_PUBLIC_GA_ID) and this visitor hasn't chosen yet */}
        <AnalyticsNotice />
      </body>
    </html>
  );
}
