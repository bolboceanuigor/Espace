'use client';

import { useEffect, useState } from 'react';
import { remindersApi } from '@/lib/api';

export default function AdminRemindersPage() {
  const [rules, setRules] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [form, setForm] = useState({
    name: '',
    triggerType: 'AFTER_DUE_DATE' as 'BEFORE_DUE_DATE' | 'AFTER_DUE_DATE' | 'DEBT_OVER_AMOUNT' | 'MONTHLY_UNPAID',
    daysOffset: 3,
    debtThreshold: 0,
    messageTemplate:
      'Salut {{residentName}}, pentru apartamentul {{apartmentNumber}} aveti sold restant {{amount}} MDL. Scadenta: {{dueDate}}.',
  });

  const load = async () => {
    const [rulesRes, logsRes] = await Promise.all([remindersApi.adminListRules(), remindersApi.adminListLogs()]);
    setRules(rulesRes.data || []);
    setLogs(logsRes.data || []);
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-foreground">Debt Collection Automation</h1>
      <div className="rounded-xl border border-border/70 bg-card p-4">
        <p className="text-sm font-medium text-foreground">Create reminder rule</p>
        <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-5">
          <input className="input" placeholder="Rule name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
          <select
            className="select"
            value={form.triggerType}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                triggerType: e.target.value as 'BEFORE_DUE_DATE' | 'AFTER_DUE_DATE' | 'DEBT_OVER_AMOUNT' | 'MONTHLY_UNPAID',
              }))
            }
          >
            <option value="BEFORE_DUE_DATE">Before due date</option>
            <option value="AFTER_DUE_DATE">After due date</option>
            <option value="DEBT_OVER_AMOUNT">Debt over amount</option>
            <option value="MONTHLY_UNPAID">Monthly unpaid</option>
          </select>
          <input className="input" type="number" value={form.daysOffset} onChange={(e) => setForm((p) => ({ ...p, daysOffset: Number(e.target.value) }))} />
          <input className="input" type="number" value={form.debtThreshold} onChange={(e) => setForm((p) => ({ ...p, debtThreshold: Number(e.target.value) }))} />
          <button
            className="rounded-md border border-border/70 px-3 py-2 text-sm"
            onClick={async () => {
              await remindersApi.adminCreateRule({
                ...form,
                channelsJson: ['IN_APP'],
              });
              setForm((p) => ({ ...p, name: '' }));
              await load();
            }}
          >
            Save rule
          </button>
        </div>
        <textarea className="input mt-2 min-h-[100px]" value={form.messageTemplate} onChange={(e) => setForm((p) => ({ ...p, messageTemplate: e.target.value }))} />
      </div>
      <div className="rounded-xl border border-border/70 bg-card p-4">
        <p className="text-sm font-medium text-foreground">Reminder rules</p>
        <div className="mt-2 space-y-1">
          {rules.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded border border-border/60 px-3 py-2 text-sm">
              <span>
                {item.name} • {item.triggerType} • {item.isActive ? 'ACTIVE' : 'DISABLED'}
              </span>
              <div className="flex gap-2">
                <button
                  className="rounded border border-border/60 px-2 py-1 text-xs"
                  onClick={async () => {
                    await remindersApi.adminUpdateRule(item.id, { isActive: !item.isActive });
                    await load();
                  }}
                >
                  {item.isActive ? 'Disable' : 'Enable'}
                </button>
                <button className="rounded border border-border/60 px-2 py-1 text-xs" onClick={async () => { await remindersApi.adminDeleteRule(item.id); await load(); }}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-border/70 bg-card p-4">
        <p className="text-sm font-medium text-foreground">Reminder logs</p>
        <div className="mt-2 space-y-1">
          {logs.slice(0, 50).map((item) => (
            <div key={item.id} className="text-sm text-muted-foreground">
              Apt {item.apartment?.number || '-'} • {item.reminderRule?.name || '-'} • {item.status} • {new Date(item.createdAt).toLocaleString()}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
