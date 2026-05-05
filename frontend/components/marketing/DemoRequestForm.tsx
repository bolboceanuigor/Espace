'use client';

import { useState } from 'react';
import { demoRequestsApi } from '@/lib/api';
import { useTranslations } from 'next-intl';
import { CheckCircle2, Loader2 } from 'lucide-react';

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

  if (done) {
    return (
      <div className="flex flex-col items-center py-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
        </div>
        <h3 className="mt-6 text-xl font-semibold text-foreground">
          {t('success')}
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Vă vom contacta în curând pentru a programa demonstrația.
        </p>
        <button
          type="button"
          onClick={() => setDone(false)}
          className="mt-6 text-sm font-medium text-foreground underline underline-offset-4 hover:no-underline"
        >
          Trimite o altă cerere
        </button>
      </div>
    );
  }

  return (
    <form
      className="space-y-5"
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
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            {t('name')} <span className="text-red-500">*</span>
          </label>
          <input
            required
            className="h-12 w-full rounded-xl border border-border/80 bg-background px-4 text-sm text-foreground placeholder:text-muted-foreground/60 transition-all focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/10"
            placeholder="Ion Popescu"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            {t('phone')} <span className="text-red-500">*</span>
          </label>
          <input
            required
            className="h-12 w-full rounded-xl border border-border/80 bg-background px-4 text-sm text-foreground placeholder:text-muted-foreground/60 transition-all focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/10"
            placeholder="+373 xx xxx xxx"
            value={form.phone}
            onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            {t('email')} <span className="text-red-500">*</span>
          </label>
          <input
            required
            type="email"
            className="h-12 w-full rounded-xl border border-border/80 bg-background px-4 text-sm text-foreground placeholder:text-muted-foreground/60 transition-all focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/10"
            placeholder="email@exemplu.md"
            value={form.email}
            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            {t('associationName')}
          </label>
          <input
            className="h-12 w-full rounded-xl border border-border/80 bg-background px-4 text-sm text-foreground placeholder:text-muted-foreground/60 transition-all focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/10"
            placeholder="Asociația de proprietari..."
            value={form.associationName}
            onChange={(e) => setForm((p) => ({ ...p, associationName: e.target.value }))}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            {t('apartmentsCount')}
          </label>
          <input
            type="number"
            className="h-12 w-full rounded-xl border border-border/80 bg-background px-4 text-sm text-foreground placeholder:text-muted-foreground/60 transition-all focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/10"
            placeholder="ex: 50"
            value={form.apartmentsCount}
            onChange={(e) => setForm((p) => ({ ...p, apartmentsCount: e.target.value }))}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            {t('preferredDate')}
          </label>
          <input
            type="date"
            className="h-12 w-full rounded-xl border border-border/80 bg-background px-4 text-sm text-foreground placeholder:text-muted-foreground/60 transition-all focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/10"
            value={form.preferredDate}
            onChange={(e) => setForm((p) => ({ ...p, preferredDate: e.target.value }))}
          />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          {t('message')}
        </label>
        <textarea
          className="min-h-[120px] w-full rounded-xl border border-border/80 bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 transition-all focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/10 resize-none"
          placeholder="Descrieți pe scurt nevoile dumneavoastră..."
          value={form.message}
          onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
        />
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={saving}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('sending')}
          </>
        ) : (
          t('submit')
        )}
      </button>

      <p className="text-center text-xs text-muted-foreground">
        Prin trimiterea formularului, sunteți de acord cu politica noastră de confidențialitate.
      </p>
    </form>
  );
}
