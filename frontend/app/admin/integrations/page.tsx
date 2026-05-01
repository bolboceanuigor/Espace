'use client';

import { useEffect, useState } from 'react';
import { notificationsApi } from '@/lib/api';

export default function AdminIntegrationsPage() {
  const [data, setData] = useState<any>(null);
  const [email, setEmail] = useState({ provider: 'SMTP', host: '', port: '587', user: '', pass: '', isActive: false });
  const [telegram, setTelegram] = useState({ botToken: '', isActive: false });
  const [sms, setSms] = useState({ provider: 'OTHER', accountSid: '', authToken: '', isActive: false });
  const [test, setTest] = useState({ title: 'Test notification', message: 'Notification test from integrations page' });

  const load = async () => {
    const res = await notificationsApi.adminGetIntegrations();
    setData(res.data);
    const e = res.data?.email;
    const t = res.data?.telegram;
    const s = res.data?.sms;
    if (e) {
      setEmail({
        provider: e.provider || 'SMTP',
        host: e.configJson?.host || '',
        port: String(e.configJson?.port || '587'),
        user: e.configJson?.user || '',
        pass: e.configJson?.pass || '',
        isActive: !!e.isActive,
      });
    }
    if (t) setTelegram({ botToken: t.botToken || '', isActive: !!t.isActive });
    if (s) {
      setSms({
        provider: s.provider || 'OTHER',
        accountSid: s.configJson?.accountSid || '',
        authToken: s.configJson?.authToken || '',
        isActive: !!s.isActive,
      });
    }
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Integrations</h1>
      <div className="rounded-xl border border-border/70 bg-card p-4 space-y-2">
        <p className="text-sm font-medium">Email</p>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
          <select className="select" value={email.provider} onChange={(e) => setEmail((p) => ({ ...p, provider: e.target.value }))}>
            {['SMTP', 'SENDGRID', 'OTHER'].map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
          <input className="input" placeholder="Host" value={email.host} onChange={(e) => setEmail((p) => ({ ...p, host: e.target.value }))} />
          <input className="input" placeholder="Port" value={email.port} onChange={(e) => setEmail((p) => ({ ...p, port: e.target.value }))} />
          <input className="input" placeholder="User" value={email.user} onChange={(e) => setEmail((p) => ({ ...p, user: e.target.value }))} />
          <input className="input" placeholder="Pass" value={email.pass} onChange={(e) => setEmail((p) => ({ ...p, pass: e.target.value }))} />
        </div>
        <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={email.isActive} onChange={(e) => setEmail((p) => ({ ...p, isActive: e.target.checked }))} /> Active</label>
        <button className="rounded-md border border-border/70 px-3 py-2 text-sm" onClick={async () => {
          await notificationsApi.adminUpdateEmailIntegration({
            provider: email.provider as any,
            isActive: email.isActive,
            configJson: { host: email.host, port: Number(email.port || 587), user: email.user, pass: email.pass },
          });
          await load();
        }}>Save Email</button>
      </div>

      <div className="rounded-xl border border-border/70 bg-card p-4 space-y-2">
        <p className="text-sm font-medium">Telegram</p>
        <input className="input" placeholder="Bot token" value={telegram.botToken} onChange={(e) => setTelegram((p) => ({ ...p, botToken: e.target.value }))} />
        <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={telegram.isActive} onChange={(e) => setTelegram((p) => ({ ...p, isActive: e.target.checked }))} /> Active</label>
        <button className="rounded-md border border-border/70 px-3 py-2 text-sm" onClick={async () => {
          await notificationsApi.adminUpdateTelegramIntegration(telegram);
          await load();
        }}>Save Telegram</button>
      </div>

      <div className="rounded-xl border border-border/70 bg-card p-4 space-y-2">
        <p className="text-sm font-medium">SMS</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <select className="select" value={sms.provider} onChange={(e) => setSms((p) => ({ ...p, provider: e.target.value }))}>
            {['TWILIO', 'OTHER'].map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
          <input className="input" placeholder="Account SID" value={sms.accountSid} onChange={(e) => setSms((p) => ({ ...p, accountSid: e.target.value }))} />
          <input className="input" placeholder="Auth token" value={sms.authToken} onChange={(e) => setSms((p) => ({ ...p, authToken: e.target.value }))} />
        </div>
        <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={sms.isActive} onChange={(e) => setSms((p) => ({ ...p, isActive: e.target.checked }))} /> Active</label>
        <button className="rounded-md border border-border/70 px-3 py-2 text-sm" onClick={async () => {
          await notificationsApi.adminUpdateSmsIntegration({
            provider: sms.provider as any,
            isActive: sms.isActive,
            configJson: { accountSid: sms.accountSid, authToken: sms.authToken },
          });
          await load();
        }}>Save SMS</button>
      </div>

      <div className="rounded-xl border border-border/70 bg-card p-4 space-y-2">
        <p className="text-sm font-medium">Test notification</p>
        <input className="input" value={test.title} onChange={(e) => setTest((p) => ({ ...p, title: e.target.value }))} />
        <input className="input" value={test.message} onChange={(e) => setTest((p) => ({ ...p, message: e.target.value }))} />
        <button className="rounded-md border border-border/70 px-3 py-2 text-sm" onClick={async () => { await notificationsApi.adminTest(test); }}>Send test</button>
      </div>
    </div>
  );
}

