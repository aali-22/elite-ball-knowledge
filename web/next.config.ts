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

// Scripts and styles come from this origin only (Next's inline bootstrap needs 'unsafe-inline'; dev needs eval for
// fast refresh). No third-party image, frame or request unless a local workspace adds a host.
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${DEV ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob:${WORK ? ` ${WORK.imgSrc}` : ""}`,
  "font-src 'self' data:",
  `connect-src 'self'${DEV ? " ws:" : ""}`,
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
  env: { NEXT_PUBLIC_LAB: LAB ? "1" : "" },
  experimental: { proxyTimeout: WORK?.proxyTimeoutMs ?? 30 * 1000 },
  async rewrites() {
    return LAB ? [{ source: "/api/:path*", destination: `${API_BASE}/:path*` }]
      : [{ source: "/api/public/:path*", destination: `${API_BASE}/public/:path*` }];
  },
  async redirects() {
    return [
      ...(WORK?.moved ?? []).flatMap((p) => [
        { source: `/${p}`, destination: `/lab/${p}`, permanent: false },
        { source: `/${p}/:path*`, destination: `/lab/${p}/:path*`, permanent: false },
      ]),
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
    }];
  },
  images: { remotePatterns: (WORK?.imageHosts ?? []).map((hostname) => ({ protocol: "https" as const, hostname })) },
};

export default nextConfig;
