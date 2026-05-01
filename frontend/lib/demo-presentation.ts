'use client';

export const DEMO_PRESENTATION_MODE_KEY = 'demoPresentationMode';

export function isDemoPresentationModeEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(DEMO_PRESENTATION_MODE_KEY) === 'true';
}

export function setDemoPresentationModeEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DEMO_PRESENTATION_MODE_KEY, enabled ? 'true' : 'false');
}
