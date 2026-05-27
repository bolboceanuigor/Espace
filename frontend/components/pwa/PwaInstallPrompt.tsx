'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, X } from 'lucide-react';
import { Button } from '@/components/ui';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

const DISMISS_KEY = 'espace:pwa-install-dismissed-at';
const DISMISS_DAYS = 14;

function recentlyDismissed() {
  if (typeof window === 'undefined') return true;
  const raw = window.localStorage.getItem(DISMISS_KEY);
  if (!raw) return false;
  const value = Number(raw);
  if (!Number.isFinite(value)) return false;
  return Date.now() - value < DISMISS_DAYS * 24 * 60 * 60 * 1000;
}

export default function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const isIos = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
  }, []);

  useEffect(() => {
    if (recentlyDismissed()) return;
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
    if (standalone) return;

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    if (isIos) {
      const timer = window.setTimeout(() => setVisible(true), 1000);
      return () => {
        window.clearTimeout(timer);
        window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      };
    }
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
  }, [isIos]);

  function dismiss() {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  }

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice.catch(() => undefined);
    dismiss();
  }

  if (!visible) return null;

  return (
    <div className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
          <Download className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-950">Instalează Espace pe telefon</p>
          <p className="mt-1 text-sm leading-5 text-slate-500">
            {isIos && !installEvent ? 'Pe iPhone: Share → Add to Home Screen.' : 'Adaugă portalul pe ecranul principal pentru acces rapid.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {installEvent ? (
              <Button type="button" size="sm" onClick={install}>
                Instalează
              </Button>
            ) : null}
            <Button type="button" size="sm" variant="secondary" onClick={dismiss}>
              Mai târziu
            </Button>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
          aria-label="Ascunde promptul de instalare"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
