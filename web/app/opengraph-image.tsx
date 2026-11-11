import { ImageResponse } from "next/og";
import { SITE } from "@/lib/site";

// The card a link to the site shows when it is shared: drawn at build time, no image file.
export const alt = `${SITE.name}: ${SITE.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  const bars = [0.92, 0.61, 0.78, 0.34, 0.86, 0.5, 0.7];
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72,
        background: "#0b0b0b", color: "#ecebe6" }}>
        <div style={{ display: "flex", fontSize: 26, letterSpacing: 6, color: "#ff3b1f" }}>SPORTS ANALYTICS, SHOWN NOT TOLD</div>
        <div style={{ display: "flex", flexDirection: "column", fontSize: 148, fontWeight: 800, lineHeight: 0.92, letterSpacing: -3 }}>
          <div style={{ display: "flex" }}>ELITE BALL</div>
          <div style={{ display: "flex", color: "#ff3b1f" }}>KNOWLEDGE</div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontSize: 30, color: "#8f8d86", maxWidth: 640 }}>{SITE.tagline} Every claim next to the chart that proves it.</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 120 }}>
            {bars.map((b, i) => <div key={i} style={{ width: 26, height: `${b * 100}%`, borderRadius: 6, background: i % 2 ? "#d95926" : "#3987e5" }} />)}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
