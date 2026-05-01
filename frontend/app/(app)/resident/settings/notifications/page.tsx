'use client';

import { useEffect, useState } from 'react';
import { notificationsApi } from '@/lib/api';

export default function ResidentNotificationSettingsPage() {
  const [prefs, setPrefs] = useState<any>({
    emailEnabled: true,
    telegramEnabled: false,
    smsEnabled: false,
    inAppEnabled: true,
  });
  const [telegramToken, setTelegramToken] = useState<string>('');

  const load = async () => {
    const res = await notificationsApi.residentPreferences();
    setPrefs({
      emailEnabled: !!res.data?.emailEnabled,
      telegramEnabled: !!res.data?.telegramEnabled,
      smsEnabled: !!res.data?.smsEnabled,
      inAppEnabled: !!res.data?.inAppEnabled,
    });
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Notification preferences</h1>
      <div className="rounded-xl border border-border/70 bg-card p-4 space-y-2">
        {[
          ['emailEnabled', 'Email'],
          ['telegramEnabled', 'Telegram'],
          ['smsEnabled', 'SMS'],
          ['inAppEnabled', 'In-app'],
        ].map(([key, label]) => (
          <label key={key} className="flex items-center justify-between text-sm">
            <span>{label}</span>
            <input
              type="checkbox"
              checked={!!prefs[key]}
              onChange={(e) => setPrefs((p: any) => ({ ...p, [key]: e.target.checked }))}
            />
          </label>
        ))}
        <button className="rounded-md border border-border/70 px-3 py-2 text-sm" onClick={async () => {
          await notificationsApi.residentUpdatePreferences(prefs);
          await load();
        }}>
          Save preferences
        </button>
      </div>

      <div className="rounded-xl border border-border/70 bg-card p-4 space-y-2">
        <p className="text-sm font-medium">Connect Telegram</p>
        <p className="text-xs text-muted-foreground">Generate token and send `/link TOKEN` to your Telegram bot.</p>
        <button className="rounded-md border border-border/70 px-3 py-2 text-sm" onClick={async () => {
          const res = await notificationsApi.residentGenerateTelegramToken();
          setTelegramToken(res.data?.token || '');
        }}>
          Generate token
        </button>
        {telegramToken ? <p className="text-xs font-mono">{telegramToken}</p> : null}
      </div>
    </div>
  );
}

