'use client';

import { useEffect, useMemo, useState } from 'react';
import { superadminApi } from '@/lib/api';

const TARGETS = ['ALL', 'ADMIN', 'RESIDENT', 'TEAM'] as const;
const SAMPLE_VARS: Record<string, string> = {
  userName: 'Ion Popescu',
  organizationName: 'Asociatia Central Park',
  inviteLink: 'https://app.espace.ro/accept/abc123',
  apartmentNumber: 'B12',
  trialEndDate: '2026-05-10',
  supportEmail: 'support@espace.md',
};

function renderTemplate(input: string, vars: Record<string, string>) {
  return input.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key: string) => vars[key] ?? '');
}

export default function SuperadminEmailTemplatesPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [form, setForm] = useState({
    key: '',
    name: '',
    subject: '',
    body: '',
    targetRole: 'ALL' as (typeof TARGETS)[number],
    isDefault: false,
  });

  const selected = useMemo(() => rows.find((row) => row.id === selectedId) || null, [rows, selectedId]);

  const load = async () => {
    const res = await superadminApi.listEmailTemplates();
    setRows(res.data || []);
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-foreground">Email templates</h1>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border/70 bg-card p-4">
          <p className="mb-2 text-sm font-medium">Create / edit template</p>
          <div className="space-y-2">
            <input className="input" placeholder="Key (e.g. resident_invitation)" value={form.key} onChange={(e) => setForm((p) => ({ ...p, key: e.target.value }))} />
            <input className="input" placeholder="Template name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            <input className="input" placeholder="Subject" value={form.subject} onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))} />
            <textarea
              className="w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-sm text-foreground"
              rows={8}
              placeholder="Body"
              value={form.body}
              onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))}
            />
            <div className="flex flex-wrap items-center gap-2">
              <select className="input w-40" value={form.targetRole} onChange={(e) => setForm((p) => ({ ...p, targetRole: e.target.value as any }))}>
                {TARGETS.map((target) => (
                  <option key={target} value={target}>
                    {target}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm((p) => ({ ...p, isDefault: e.target.checked }))} />
                Default
              </label>
              <button
                className="rounded-md border border-border/70 px-3 py-2 text-sm"
                onClick={async () => {
                  if (!form.key.trim() || !form.name.trim() || !form.subject.trim() || !form.body.trim()) return;
                  if (selectedId) {
                    await superadminApi.updateEmailTemplate(selectedId, {
                      key: form.key,
                      name: form.name,
                      subject: form.subject,
                      body: form.body,
                      targetRole: form.targetRole,
                      isDefault: form.isDefault,
                    });
                  } else {
                    await superadminApi.createEmailTemplate(form);
                  }
                  setSelectedId('');
                  setForm({ key: '', name: '', subject: '', body: '', targetRole: 'ALL', isDefault: false });
                  await load();
                }}
              >
                {selectedId ? 'Save changes' : 'Create template'}
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-4">
          <p className="mb-2 text-sm font-medium">Preview with sample variables</p>
          <div className="space-y-2 text-sm">
            <div className="rounded-lg border border-border/60 bg-background p-3">
              <p className="text-xs text-muted-foreground">Subject</p>
              <p className="font-medium text-foreground">{renderTemplate(form.subject || selected?.subject || '', SAMPLE_VARS)}</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-background p-3">
              <p className="text-xs text-muted-foreground">Body</p>
              <p className="whitespace-pre-wrap text-foreground">{renderTemplate(form.body || selected?.body || '', SAMPLE_VARS)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border/70 bg-card">
        <table className="min-w-full text-sm">
          <thead className="border-b border-border/70 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Key</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Target</th>
              <th className="px-3 py-2">Default</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-border/40">
                <td className="px-3 py-2">{row.key}</td>
                <td className="px-3 py-2">{row.name}</td>
                <td className="px-3 py-2">{row.targetRole}</td>
                <td className="px-3 py-2">{row.isDefault ? 'Yes' : 'No'}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-2">
                    <button
                      className="rounded-md border border-border/70 px-2 py-1 text-xs"
                      onClick={() => {
                        setSelectedId(row.id);
                        setForm({
                          key: row.key || '',
                          name: row.name || '',
                          subject: row.subject || '',
                          body: row.body || '',
                          targetRole: row.targetRole || 'ALL',
                          isDefault: !!row.isDefault,
                        });
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="rounded-md border border-border/70 px-2 py-1 text-xs"
                      onClick={async () => {
                        await superadminApi.deleteEmailTemplate(row.id);
                        if (selectedId === row.id) {
                          setSelectedId('');
                          setForm({ key: '', name: '', subject: '', body: '', targetRole: 'ALL', isDefault: false });
                        }
                        await load();
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                  No templates found
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
