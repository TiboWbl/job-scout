// Company accent colours, ported from the validated mockup (design/mockups/color.js).
// A brand colour is only ever an accent: lightened and desaturated surfaces, and a text accent
// pushed until it passes WCAG AA against its own surface, in light and dark mode.

export const AA_TEXT = 4.5;
export const AA_GRAPHIC = 3;
const NEUTRAL = { h: 40, s: 0.06 };

type Hsl = { h: number; s: number };

export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return "#" + [f(0), f(8), f(4)].map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("");
}

function hexToRgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

function luminance(hex: string) {
  const c = hexToRgb(hex).map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

export function contrast(a: string, b: string) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

// Dominant saturated colour of a logo from raw RGBA pixels; null for black-and-white logos.
export function dominantColor(rgba: Uint8Array | Uint8ClampedArray): string | null {
  const buckets = new Map<number, { n: number; h: number; s: number; l: number }>();
  let opaque = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] < 200) continue;
    opaque++;
    const [h, s, l] = rgbToHsl(rgba[i], rgba[i + 1], rgba[i + 2]);
    if (s < 0.25 || l < 0.12 || l > 0.9) continue;
    const key = Math.round(h / 15);
    const b = buckets.get(key) ?? { n: 0, h: 0, s: 0, l: 0 };
    b.n++; b.h += h; b.s += s; b.l += l;
    buckets.set(key, b);
  }
  const best = [...buckets.values()].sort((a, b) => b.n - a.n)[0];
  if (!best || best.n < opaque * 0.04) return null;
  return hslToHex(best.h / best.n, best.s / best.n, best.l / best.n);
}

function hexToHs(hex: string): Hsl {
  const [h, s] = rgbToHsl(...hexToRgb(hex));
  return { h, s };
}

function reach(h: number, s: number, startL: number, step: number, bg: string, target: number) {
  let l = startL;
  let c = hslToHex(h, s, l);
  while (contrast(c, bg) < target && l > 0.02 && l < 0.98) {
    l += step;
    c = hslToHex(h, s, l);
  }
  return c;
}

const BASE = {
  light: { ink: "#17151f", muted: "#544f60", button: "#17151f" },
  dark: { ink: "#f4f2f7", muted: "#b9b4c6", button: "#f4f2f7" },
} as const;

export type Mode = keyof typeof BASE;

export type Tokens = {
  bg: string;
  band: string;
  halo: string;
  accent: string;
  checks: { titre: number; texte: number; accent: number; bouton: number };
  pass: boolean;
};

export function tokens(accentHex: string | null | undefined, mode: Mode): Tokens {
  const color = accentHex ? hexToHs(accentHex) : null;
  const { h, s: raw } = color ?? NEUTRAL;
  const s = Math.min(raw, 0.8);
  const surfaces =
    mode === "light"
      ? { bg: hslToHex(h, s * 0.75, 0.92), band: hslToHex(h, s * 0.8, 0.86), halo: hslToHex(h, s * 0.8, 0.79) }
      : { bg: hslToHex(h, s * 0.34, 0.145), band: hslToHex(h, s * 0.4, 0.2), halo: hslToHex(h, s * 0.48, 0.3) };
  // A real brand colour keeps enough saturation to read as colour; the neutral fallback stays grey.
  const accentS = color ? Math.max(s, 0.35) : s;
  const accent = mode === "light"
    ? reach(h, accentS, 0.42, -0.02, surfaces.bg, AA_TEXT)
    : reach(h, accentS, 0.7, 0.02, surfaces.bg, AA_TEXT);
  const base = BASE[mode];
  const checks = {
    titre: contrast(base.ink, surfaces.bg),
    texte: contrast(base.muted, surfaces.bg),
    accent: contrast(accent, surfaces.bg),
    bouton: contrast(base.button, surfaces.bg),
  };
  const pass = checks.titre >= AA_TEXT && checks.texte >= AA_TEXT && checks.accent >= AA_TEXT && checks.bouton >= AA_GRAPHIC;
  return { ...surfaces, accent, checks, pass };
}

// Inline CSS variables consumed by the `.tinted` class in globals.css.
export function tintStyle(accentHex: string | null | undefined): Record<string, string> {
  const l = tokens(accentHex, "light");
  const d = tokens(accentHex, "dark");
  return {
    "--bg-l": l.bg, "--band-l": l.band, "--halo-l": l.halo, "--accent-l": l.accent,
    "--bg-d": d.bg, "--band-d": d.band, "--halo-d": d.halo, "--accent-d": d.accent,
  };
}

// By domain when known; otherwise logo.dev looks the brand up by name and answers 404 when unsure,
// so the monogram takes over instead of a wrong logo.
export function logoUrl(domain: string | null | undefined, size = 128, name?: string | null): string | null {
  const token = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN;
  if (domain) return token ? `https://img.logo.dev/${domain}?token=${token}&size=${size}&format=png&retina=true` : `https://unavatar.io/${domain}?fallback=false`;
  if (!token || !name || /non communiqu|confidenti|anonyme/i.test(name)) return null;
  return `https://img.logo.dev/name/${encodeURIComponent(name.trim())}?token=${token}&size=${size}&format=png&retina=true&fallback=404`;
}
