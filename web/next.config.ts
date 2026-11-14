import { existsSync, readFileSync } from "node:fs";
import type { NextConfig } from "next";

// Same-origin API: the browser calls /api/*, Next forwards to FastAPI (cookies + SSE work without CORS).
const API_BASE = process.env.API_BASE ?? "http://127.0.0.1:8000";
// A checkout may carry a local workspace in app/lab with its own settings (app/lab/site.json): pages that moved under
// /lab, extra image and frame hosts, a longer proxy timeout. Without it this is the site alone, and the API proxy
// reaches only the public routes.
type Workspace = { moved: string[]; imgSrc: string; frameSrc: string; proxyTimeoutMs: number; imageHosts: string[] };
const LAB = existsSync("./app/lab/site.json");
const WORK: Workspace | null = LAB ? JSON.parse(readFileSync("./app/lab/site.json", "utf8")) : null;
const DEV = process.env.NODE_ENV !== "production";
// Team marks and player photos are hotlinked from two image hosts (lib/teamMedia.ts). NEXT_PUBLIC_TEAM_MEDIA=0 turns
// the layer off, and then the page may load no third-party image at all.
const MEDIA = process.env.NEXT_PUBLIC_TEAM_MEDIA !== "0" ? " https://a.espncdn.com https://images.fotmob.com" : "";
// Visit counting (lib/analytics.ts) exists only in a build with a Google Analytics 4 measurement id. Only then does
// the policy admit Google's hosts: its script, where it reports to, and its image fallback. Without the id each of
// these is the empty string and the policy is exactly the one below.
const GA = /^G-[A-Z0-9]{4,20}$/.test(process.env.NEXT_PUBLIC_GA_ID ?? "");  // the same test as lib/site GA_ID
const GA_SCRIPT = GA ? " https://www.googletagmanager.com" : "";
const GA_CONNECT = GA ? " https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com" : "";
const GA_IMG = GA ? " https://*.google-analytics.com https://*.googletagmanager.com" : "";

// Scripts and styles come from this origin only (Next's inline bootstrap needs 'unsafe-inline'; dev needs eval for
// fast refresh). The only third-party hosts are the two image hosts of the team-media layer, when it is on, and
// Google's analytics hosts, when a measurement id is set.
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${DEV ? " 'unsafe-eval'" : ""}${GA_SCRIPT}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob:${WORK ? ` ${WORK.imgSrc}` : MEDIA}${GA_IMG}`,
  "font-src 'self' data:",
  `connect-src 'self'${DEV ? " ws:" : ""}${GA_CONNECT}`,
  `frame-src ${WORK ? WORK.frameSrc : "'none'"}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  // NEXT_DIST_DIR lets a second dev server run beside the first without sharing .next
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  poweredByHeader: false,
  devIndicators: false,
  env: { NEXT_PUBLIC_LAB: LAB ? "1" : "" },
  experimental: { proxyTimeout: WORK?.proxyTimeoutMs ?? 30 * 1000 },
  serverExternalPackages: ["@electric-sql/pglite"],  // the local accounts database loads its own WASM file from node_modules
  async rewrites() {
    const icon = { source: "/favicon.ico", destination: "/icon/192" };  // browsers ask for it by this name whatever the page declares
    // The proxy to the API leaves out /api/auth and /api/pro: those are the site's own handlers (accounts, paid
    // features; app/api). It can't be a `fallback` rewrite instead: the catch-all "not found" page matches every
    // address before a fallback is tried, so nothing would reach the API.
    return LAB ? [icon, { source: "/api/:path((?!auth(?:/|$)|pro(?:/|$)|owner(?:/|$)).*)", destination: `${API_BASE}/:path` }]
      : [icon, { source: "/api/public/:path*", destination: `${API_BASE}/public/:path*` }];
  },
  async redirects() {
    return [
      // old links into the workspace's front page that carried a query (?add=, ?site=, ?sport=) keep it
      ...(WORK ? ["add", "site", "sport", "src"].map((key) => ({ source: "/", has: [{ type: "query" as const, key }], destination: "/lab", permanent: false })) : []),
      ...(WORK?.moved ?? []).flatMap((p) => [
        { source: `/${p}`, destination: `/lab/${p}`, permanent: false },
        { source: `/${p}/:path*`, destination: `/lab/${p}/:path*`, permanent: false },
      ]),
      { source: "/picklab/sources", destination: "/sources", permanent: false },  // provenance covers the analytics too: it left the PickLab section
      { source: "/public", destination: "/picklab", permanent: false },
      { source: "/public/:path*", destination: "/picklab/:path*", permanent: false },
      { source: "/match/:id", destination: "/game/:id", permanent: false },
    ];
  },
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "Content-Security-Policy", value: CSP },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()" },
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      ],
    }, {
      source: '/account/workspace/:path*',
      headers: [
        { key: 'Cache-Control', value: 'private, no-store' },
        { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
        { key: 'Referrer-Policy', value: 'no-referrer' },
        { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-inline'" + (DEV ? " 'unsafe-eval'" : '') + "; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'" + (DEV ? ' ws:' : '') + "; frame-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
      ],
    }];
  },
  images: { remotePatterns: (WORK?.imageHosts ?? []).map((hostname) => ({ protocol: "https" as const, hostname })) },
};

export default nextConfig;
