'use client';

import { useEffect, useMemo, useState } from 'react';
import { BellRing, Smartphone } from 'lucide-react';
import { notificationsApi } from '@/lib/api';

function base64UrlToUint8Array(base64Url: string) {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) {
    output[index] = raw.charCodeAt(index);
  }
  return output;
}

type BrowserState = 'loading' | 'supported' | 'unsupported';

export default function PushOptInCard() {
  const [browserState, setBrowserState] = useState<BrowserState>('loading');
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [activeSubscriptions, setActiveSubscriptions] = useState<Array<{ id: string; endpoint: string }>>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  const enabled = activeSubscriptions.length > 0;

  const statusText = useMemo(() => {
    if (browserState === 'unsupported') return 'browser not supported';
    if (enabled && permission === 'granted') return 'enabled';
    return 'disabled';
  }, [browserState, enabled, permission]);

  const loadStatus = async () => {
    const response = await notificationsApi.pushStatus();
    const subs = (response.data?.subscriptions || []).filter((item: any) => item.isActive);
    setActiveSubscriptions(subs.map((item: any) => ({ id: item.id, endpoint: item.endpoint })));
  };

  useEffect(() => {
    const supported =
      typeof window !== 'undefined' &&
      'Notification' in window &&
      'serviceWorker' in navigator &&
      'PushManager' in window;
    if (!supported) {
      setBrowserState('unsupported');
      return;
    }
    setBrowserState('supported');
    setPermission(Notification.permission);
    loadStatus().catch(() => undefined);
  }, []);

  const onToggle = async (checked: boolean) => {
    setError('');
    if (browserState !== 'supported') return;
    setPending(true);
    try {
      if (!checked) {
        await Promise.all(activeSubscriptions.map((sub) => notificationsApi.pushDisable(sub.id)));
        setActiveSubscriptions([]);
        setPending(false);
        return;
      }

      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
      if (!publicKey) {
        setError('Push configuration is not active yet. In-app notifications remain enabled.');
        setPending(false);
        return;
      }

      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);
      if (permissionResult !== 'granted') {
        setError('Browser permission denied.');
        setPending(false);
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ||
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlToUint8Array(publicKey),
        }));
      const payload = subscription.toJSON();
      const keys = payload.keys || {};
      if (!payload.endpoint || !keys.p256dh || !keys.auth) {
        setError('Invalid browser push subscription.');
        setPending(false);
        return;
      }
      await notificationsApi.pushSubscribe({
        endpoint: payload.endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      });
      await loadStatus();
    } catch (err: any) {
      setError(err?.message || 'Failed to update push subscription.');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <BellRing className="h-4 w-4" />
            Activeaza notificarile pe telefon
          </p>
          <p className="text-xs text-muted-foreground">Status: {statusText}</p>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            className="h-4 w-4"
            disabled={browserState !== 'supported' || pending}
            checked={enabled}
            onChange={(event) => onToggle(event.target.checked)}
          />
        </label>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <Smartphone className="h-3.5 w-3.5" />
        Push va fi folosit cand configurarea completa este disponibila. Pana atunci, notificarea in-app ramane activa.
      </div>
      {error ? <p className="mt-2 text-xs text-amber-600">{error}</p> : null}
    </div>
  );
}
