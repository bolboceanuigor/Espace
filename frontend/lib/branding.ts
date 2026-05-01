export type BrandingMenuItem = {
  key: string;
  enabled: boolean;
  order: number;
};

export const DEFAULT_BRANDING_MENU: BrandingMenuItem[] = [
  { key: 'dashboard', enabled: true, order: 0 },
  { key: 'chat', enabled: true, order: 1 },
  { key: 'calendar', enabled: true, order: 2 },
  { key: 'properties', enabled: true, order: 3 },
  { key: 'reservations', enabled: true, order: 4 },
  { key: 'clients', enabled: true, order: 5 },
  { key: 'cleanings', enabled: true, order: 6 },
  { key: 'settings', enabled: true, order: 7 },
];

export const BRANDING_MENU_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  chat: 'Chat',
  calendar: 'Calendar',
  properties: 'Apartamente',
  reservations: 'Rezervari',
  clients: 'Clienti',
  cleanings: 'Curatenie',
  settings: 'Setari',
};

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
  const hex = hexColor.replace('#', '').trim();
  const normalized = hex.length === 3 ? hex.split('').map((c) => `${c}${c}`).join('') : hex;
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return '220 78% 54%';
  }

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
