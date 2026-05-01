'use client';

import { useState } from 'react';
import { demoRequestsApi } from '@/lib/api';
import { useTranslations } from 'next-intl';

type DemoRequestFormProps = {
  compact?: boolean;
};

export default function DemoRequestForm({ compact = false }: DemoRequestFormProps) {
  const t = useTranslations('marketing.form');
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    associationName: '',
    apartmentsCount: '',
    preferredDate: '',
    preferredTime: '',
    message: '',
  });
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        setSaving(true);
        setError(null);
        try {
          await demoRequestsApi.createPublic({
            name: form.name.trim(),
            phone: form.phone.trim(),
            email: form.email.trim(),
            associationName: form.associationName.trim() || undefined,
            apartmentsCount: form.apartmentsCount ? Number(form.apartmentsCount) : undefined,
            preferredDate: form.preferredDate || undefined,
            preferredTime: form.preferredTime || undefined,
            message: form.message.trim() || undefined,
          });
          setDone(true);
          setForm({
            name: '',
            phone: '',
            email: '',
            associationName: '',
            apartmentsCount: '',
            preferredDate: '',
            preferredTime: '',
            message: '',
          });
        } catch (e: any) {
          setError(e?.message || t('error'));
        } finally {
          setSaving(false);
        }
      }}
    >
      <div className={`grid grid-cols-1 gap-3 ${compact ? 'md:grid-cols-2' : 'md:grid-cols-2'}`}>
        <input
          required
          className="h-11 rounded-xl border border-border/70 bg-background px-3 text-sm"
          placeholder={t('name')}
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
        />
        <input
          required
          className="h-11 rounded-xl border border-border/70 bg-background px-3 text-sm"
          placeholder={t('phone')}
          value={form.phone}
          onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
        />
        <input
          required
          type="email"
          className="h-11 rounded-xl border border-border/70 bg-background px-3 text-sm"
          placeholder={t('email')}
          value={form.email}
          onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
        />
        <input
          className="h-11 rounded-xl border border-border/70 bg-background px-3 text-sm"
          placeholder={t('associationName')}
          value={form.associationName}
          onChange={(e) => setForm((p) => ({ ...p, associationName: e.target.value }))}
        />
        <input
          type="number"
          className="h-11 rounded-xl border border-border/70 bg-background px-3 text-sm"
          placeholder={t('apartmentsCount')}
          value={form.apartmentsCount}
          onChange={(e) => setForm((p) => ({ ...p, apartmentsCount: e.target.value }))}
        />
        <input
          type="date"
          className="h-11 rounded-xl border border-border/70 bg-background px-3 text-sm"
          placeholder={t('preferredDate')}
          value={form.preferredDate}
          onChange={(e) => setForm((p) => ({ ...p, preferredDate: e.target.value }))}
        />
        <input
          type="time"
          className="h-11 rounded-xl border border-border/70 bg-background px-3 text-sm"
          placeholder={t('preferredTime')}
          value={form.preferredTime}
          onChange={(e) => setForm((p) => ({ ...p, preferredTime: e.target.value }))}
        />
      </div>
      <textarea
        className="min-h-[120px] w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-sm"
        placeholder={t('message')}
        value={form.message}
        onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
      />
      {done ? <p className="text-sm text-emerald-700">{t('success')}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button
        type="submit"
        disabled={saving}
        className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {saving ? t('sending') : t('submit')}
      </button>
    </form>
  );
}

