// Team colours made readable on either theme (V8a, visual-audit item 1). A team colour becomes text, a bar, a dot or a
// border in many places; raw, Green Bay's #203731 vanishes on the dark card and Fenerbahçe yellow on white. teamInk keeps
// the hue and moves only OKLCH lightness, by the smallest amount that reaches WCAG 2 contrast 4.5:1 (text) or 3:1 (marks)
// against every surface the colour can sit on in that theme (background, card, the muted bar track). A colour that
// already passes is returned unchanged. Header gradients are decoration and keep the raw colour. Pure, no imports, so
// tests/lib.test.mjs can load it.

export type Theme = "light" | "dark";
export type InkUse = "text" | "mark";

/** WCAG 2 minimum contrast per use: body text 4.5:1, graphical objects 3:1 (SC 1.4.3 / 1.4.11). */
export const MIN_CONTRAST: Record<InkUse, number> = { text: 4.5, mark: 3 };

type RGB = [number, number, number];

const toLin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGam = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

export function parseHex(hex: string | null | undefined): RGB | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((hex ?? "").trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255) as RGB;
}

function toHex(rgb: RGB): string {
  return "#" + rgb.map((c) => Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, "0")).join("");
}

/** WCAG relative luminance of a gamma-encoded sRGB colour. */
const luminance = ([r, g, b]: RGB) => 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);

/** WCAG 2 contrast ratio between two hex colours (1…21). */
export function contrast(a: string, b: string): number {
  const x = parseHex(a), y = parseHex(b);
  if (!x || !y) return 1;
  const [hi, lo] = [luminance(x), luminance(y)].sort((p, q) => q - p);
  return (hi + 0.05) / (lo + 0.05);
}

/** Lowest contrast of a colour against any surface of the theme. */
export const worstContrast = (hex: string, theme: Theme) => Math.min(...SURFACES[theme].map((s) => contrast(hex, s)));

// OKLab (Björn Ottosson, 2020), on linear sRGB.
function toOklch([r, g, b]: RGB): [number, number, number] {
  const [lr, lg, lb] = [toLin(r), toLin(g), toLin(b)];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [L, Math.hypot(A, B), Math.atan2(B, A)];
}

/** OKLCH → linear sRGB (may fall outside [0, 1]). */
function oklchLin(L: number, C: number, h: number): RGB {
  const A = C * Math.cos(h), B = C * Math.sin(h);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const inGamut = (c: RGB) => c.every((v) => v >= -1e-4 && v <= 1 + 1e-4);

/** OKLCH → hex, lowering chroma (never hue or lightness) until the colour fits sRGB. */
function oklchHex(L: number, C: number, h: number): string {
  let lin = oklchLin(L, C, h);
  if (!inGamut(lin)) {
    let lo = 0, hi = C;
    for (let i = 0; i < 20; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(oklchLin(L, mid, h))) lo = mid; else hi = mid;
    }
    lin = oklchLin(L, lo, h);
  }
  return toHex(lin.map(toGam) as RGB);
}

/** The theme surfaces from globals.css: --background, --card, --muted (bar tracks), --viz-surface. Neutral tokens are
 *  OKLCH with zero chroma, so each is its lightness. */
export const SURFACES: Record<Theme, string[]> = {
  light: [oklchHex(1, 0, 0), oklchHex(0.97, 0, 0), "#fcfcfb"],
  dark: [oklchHex(0.145, 0, 0), oklchHex(0.205, 0, 0), oklchHex(0.269, 0, 0), "#1a1a19"],
};

const cache = new Map<string, string>();

/** The team colour as it should be drawn on `theme`: unchanged when it already reaches the use's contrast against every
 *  surface, else the same hue with its OKLCH lightness moved (up on dark, down on light) just far enough. A missing or
 *  unreadable colour starts from a mid grey. */
export function teamInk(hex: string | null | undefined, theme: Theme, use: InkUse = "text"): string {
  const key = `${hex}|${theme}|${use}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const rgb = parseHex(hex) ?? parseHex("#808080")!;
  const raw = toHex(rgb);
  const min = MIN_CONTRAST[use];
  let out = raw;
  if (worstContrast(raw, theme) < min) {
    const [L0, C, h] = toOklch(rgb);
    const end = theme === "dark" ? 1 : 0; // white passes on every dark surface, black on every light one
    let bad = L0, good = end;
    for (let i = 0; i < 24; i++) {
      const mid = (bad + good) / 2;
      if (worstContrast(oklchHex(mid, C, h), theme) >= min) good = mid; else bad = mid;
    }
    out = oklchHex(good, C, h);
    // Rounding to 8-bit can cost a hair of contrast; step on until the hex itself passes.
    for (let L = good; worstContrast(out, theme) < min && L >= 0 && L <= 1; L += theme === "dark" ? 0.002 : -0.002) out = oklchHex(L, C, h);
  }
  cache.set(key, out);
  return out;
}

/** Text on a filled team colour (a chip, a speaker dot, a player on the field): white or near-black, whichever reads
 *  better against it. */
export function onInk(fillHex: string): string {
  return contrast(fillHex, "#ffffff") >= contrast(fillHex, "#111111") ? "#ffffff" : "#111111";
}
