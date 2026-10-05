// Moteur de couleur de Scout (prototype, à porter tel quel dans l'app).
// 1. Extrait la couleur dominante d'un logo (en production : une fois, à la collecte).
// 2. En dérive des teintes calmes : fond très clair, halo, bandeau. Jamais d'aplat saturé.
// 3. Ajuste la couleur d'accent du texte jusqu'à passer WCAG AA, en clair comme en sombre.

const AA_TEXT = 4.5;
const AA_GRAPHIC = 3;
const NEUTRAL = { h: 40, s: 0.06 }; // logo noir et blanc ou couleur introuvable

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

function hslToRgb(h, s, l) {
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

const hex = ([r, g, b]) => "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
const parseHex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

function luminance([r, g, b]) {
  const c = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

function contrast(a, b) {
  const [l1, l2] = [luminance(parseHex(a)), luminance(parseHex(b))].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

// Couleur dominante parmi les pixels opaques et saturés ; null si le logo est neutre.
function extractColor(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const n = 48;
      const canvas = document.createElement("canvas");
      canvas.width = n; canvas.height = n;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, n, n);
      let data;
      try { data = ctx.getImageData(0, 0, n, n).data; } catch { return resolve(null); }
      const buckets = new Map();
      let opaque = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 200) continue;
        opaque++;
        const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
        if (s < 0.25 || l < 0.12 || l > 0.9) continue;
        const key = Math.round(h / 15);
        const b = buckets.get(key) || { n: 0, h: 0, s: 0 };
        b.n++; b.h += h; b.s += s;
        buckets.set(key, b);
      }
      const best = [...buckets.values()].sort((a, b) => b.n - a.n)[0];
      if (!best || best.n < opaque * 0.04) return resolve(null);
      resolve({ h: best.h / best.n, s: best.s / best.n });
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

// Pousse la luminosité dans une direction jusqu'à atteindre le ratio voulu face au fond.
function reach(h, s, startL, step, bg, target) {
  let l = startL;
  let c = hex(hslToRgb(h, s, l));
  while (contrast(c, bg) < target && l > 0.02 && l < 0.98) {
    l += step;
    c = hex(hslToRgb(h, s, l));
  }
  return c;
}

const BASE = {
  light: { ink: "#17151F", muted: "#544F60", button: "#17151F" },
  dark: { ink: "#F4F2F7", muted: "#B9B4C6", button: "#F4F2F7" },
};

function tokens(color, mode) {
  const { h, s: raw } = color || NEUTRAL;
  const s = Math.min(raw, 0.8);
  const base = BASE[mode];
  const t = mode === "light"
    ? {
        bg: hex(hslToRgb(h, s * 0.45, 0.955)),
        band: hex(hslToRgb(h, s * 0.5, 0.915)),
        halo: hex(hslToRgb(h, s * 0.55, 0.86)),
      }
    : {
        bg: hex(hslToRgb(h, s * 0.28, 0.135)),
        band: hex(hslToRgb(h, s * 0.32, 0.18)),
        halo: hex(hslToRgb(h, s * 0.4, 0.28)),
      };
  // A real brand colour gets a minimum saturation so the accent reads as colour; the neutral
  // fallback stays grey rather than drifting towards brown.
  const accentS = color ? Math.max(s, 0.35) : s;
  t.accent = mode === "light"
    ? reach(h, accentS, 0.42, -0.02, t.bg, AA_TEXT)
    : reach(h, accentS, 0.7, 0.02, t.bg, AA_TEXT);
  t.ink = base.ink;
  t.muted = base.muted;
  t.checks = {
    titre: contrast(base.ink, t.bg),
    texte: contrast(base.muted, t.bg),
    accent: contrast(t.accent, t.bg),
    bouton: contrast(base.button, t.bg),
  };
  t.pass = t.checks.titre >= AA_TEXT && t.checks.texte >= AA_TEXT && t.checks.accent >= AA_TEXT && t.checks.bouton >= AA_GRAPHIC;
  return t;
}

function applyTokens(el, light, dark) {
  for (const [mode, t] of [["l", light], ["d", dark]]) {
    el.style.setProperty(`--bg-${mode}`, t.bg);
    el.style.setProperty(`--band-${mode}`, t.band);
    el.style.setProperty(`--halo-${mode}`, t.halo);
    el.style.setProperty(`--accent-${mode}`, t.accent);
  }
}
