type ThemeTokens = Record<string, string>;

const THEME_TOKEN_KEYS = [
  '--primary',
  '--primary-foreground',
  '--accent',
  '--accent-foreground',
  '--ring',
  '--sidebar-primary',
  '--sidebar-primary-foreground',
  '--sidebar-ring',
  '--gradient-primary',
  '--shadow-glow',
  '--pink-glow',
] as const;

let defaultTokens: ThemeTokens | null = null;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const normalizeHex = (input?: string) => {
  if (!input) return '';
  const raw = input.trim().toLowerCase();
  if (!raw) return '';
  if (raw.startsWith('#')) return raw;
  return `#${raw}`;
};

const hexToRgb = (hex: string) => {
  const normalized = hex.replace('#', '');
  if (![3, 6].includes(normalized.length)) return null;
  const full = normalized.length === 3
    ? normalized.split('').map((char) => `${char}${char}`).join('')
    : normalized;
  const value = Number.parseInt(full, 16);
  if (Number.isNaN(value)) return null;
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
};

const rgbToHsl = (r: number, g: number, b: number) => {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      default:
        h = (rn - gn) / d + 4;
        break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
};

const hslToCss = (h: number, s: number, l: number) => `${h} ${s}% ${l}%`;

const pickForeground = (l: number) => (l > 60 ? '0 0% 10%' : '0 0% 98%');

const buildThemeTokens = (hex: string): ThemeTokens | null => {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const primary = hslToCss(hsl.h, hsl.s, hsl.l);
  const accent = hslToCss(hsl.h, clamp(hsl.s + 4, 0, 100), clamp(hsl.l + 6, 0, 100));
  const shadow = `0 0 40px hsl(${primary} / 0.25)`;
  const gradientTo = hslToCss(hsl.h, clamp(hsl.s - 6, 0, 100), clamp(hsl.l - 12, 0, 100));
  const foreground = pickForeground(hsl.l);

  return {
    '--primary': primary,
    '--primary-foreground': foreground,
    '--accent': accent,
    '--accent-foreground': foreground,
    '--ring': primary,
    '--sidebar-primary': primary,
    '--sidebar-primary-foreground': foreground,
    '--sidebar-ring': primary,
    '--gradient-primary': `linear-gradient(135deg, hsl(${primary}) 0%, hsl(${gradientTo}) 100%)`,
    '--shadow-glow': shadow,
    '--pink-glow': primary,
  };
};

const captureDefaultTokens = () => {
  if (typeof window === 'undefined') return null;
  const style = window.getComputedStyle(document.documentElement);
  const tokens: ThemeTokens = {};
  THEME_TOKEN_KEYS.forEach((key) => {
    tokens[key] = style.getPropertyValue(key).trim();
  });
  return tokens;
};

const applyTokens = (tokens: ThemeTokens) => {
  const root = document.documentElement;
  Object.entries(tokens).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
};

export const applyTheme = (primaryColor?: string | null) => {
  if (typeof window === 'undefined') return;
  if (!defaultTokens) {
    defaultTokens = captureDefaultTokens();
  }
  const normalized = normalizeHex(primaryColor);
  if (!normalized) {
    if (defaultTokens) {
      applyTokens(defaultTokens);
    }
    return;
  }
  const tokens = buildThemeTokens(normalized);
  if (!tokens) {
    if (defaultTokens) {
      applyTokens(defaultTokens);
    }
    return;
  }
  applyTokens(tokens);
};

export const MANAGGIO_PRIMARY = '#fcbc23';
