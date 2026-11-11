import { ImageResponse } from "next/og";

// Home-screen / tab icon, drawn at build time (no image files): the site's initials on its dark background.
export function appIcon(size: number) {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", background: "#0a0a0a", color: "#fafafa", fontWeight: 700,
        fontSize: size * 0.36, letterSpacing: -size * 0.02 }}>
        EBK
        <div style={{ width: size * 0.36, height: size * 0.05, marginTop: size * 0.02, borderRadius: size, background: "#ff3b1f" }} />
      </div>
    ),
    { width: size, height: size },
  );
}
