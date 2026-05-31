export type BrandingMenuItem = {
  key: string;
  enabled: boolean;
  order: number;
};

export const DEFAULT_BRANDING_MENU: BrandingMenuItem[] = [
  { key: 'admin', enabled: true, order: 0 },
  { key: 'apartments', enabled: true, order: 1 },
  { key: 'residents', enabled: true, order: 2 },
  { key: 'meters', enabled: true, order: 3 },
  { key: 'payments', enabled: true, order: 4 },
  { key: 'issues', enabled: true, order: 5 },
  { key: 'announcements', enabled: true, order: 6 },
  { key: 'chat', enabled: true, order: 7 },
  { key: 'settings', enabled: true, order: 8 },
];

export const BRANDING_MENU_LABELS: Record<string, string> = {
  admin: 'Acasă',
  apartments: 'Apartamente',
  residents: 'Locatari',
  meters: 'Contoare',
  payments: 'Plăți',
  issues: 'Cereri',
  announcements: 'Avizier',
  chat: 'Mesaje',
  settings: 'Setări',
};

export const DEFAULT_PRIMARY_COLOR = '#145C55';
export const DEFAULT_SIDEBAR_COLOR = '#0F172A';

function normalizeHexColor(input: string | null | undefined, fallback: string) {
  const raw = String(input || '').trim();
  const hex = raw.startsWith('#') ? raw.slice(1) : raw;
  const normalized = hex.length === 3 ? hex.split('').map((c) => `${c}${c}`).join('') : hex;
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return fallback;
  return `#${normalized.toUpperCase()}`;
}

function relativeLuminance(hexColor: string) {
  const hex = normalizeHexColor(hexColor, '#000000').slice(1);
  const [r, g, b] = [0, 2, 4].map((offset) => {
    const channel = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function normalizePrimaryColor(input: string | null | undefined) {
  return normalizeHexColor(input, DEFAULT_PRIMARY_COLOR);
}

export function normalizeSidebarColor(input: string | null | undefined) {
  const normalized = normalizeHexColor(input, DEFAULT_SIDEBAR_COLOR);
  return relativeLuminance(normalized) > 0.72 ? DEFAULT_SIDEBAR_COLOR : normalized;
}

export function normalizeMenuConfig(input: unknown): BrandingMenuItem[] {
  const raw = Array.isArray(input) ? input : [];
  const map = new Map<string, BrandingMenuItem>();

  for (const fallback of DEFAULT_BRANDING_MENU) {
    map.set(fallback.key, fallback);
  }

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const key = String((item as { key?: unknown }).key || '');
    if (!map.has(key)) continue;
    const enabled = Boolean((item as { enabled?: unknown }).enabled);
    const order = Number((item as { order?: unknown }).order);
    map.set(key, {
      key,
      enabled,
      order: Number.isFinite(order) ? order : map.get(key)!.order,
    });
  }

  return Array.from(map.values()).sort((a, b) => a.order - b.order);
}

export function hexToHslTriplet(hexColor: string): string {
  const normalized = normalizeHexColor(hexColor, DEFAULT_PRIMARY_COLOR).slice(1);

  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
  }
  h = Math.round(h * 60);
  if (h < 0) h += 360;

  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  return `${h} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}
