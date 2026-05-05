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

  const inputClasses = "h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 placeholder:text-gray-400 transition-all focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20";

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-teal-100">
          <CheckCircle2 className="h-8 w-8 text-teal-600" />
        </div>
        <p className="mt-4 text-lg font-semibold text-gray-900">{t('success')}</p>
        <p className="mt-2 text-sm text-gray-600">Vă vom contacta în cel mai scurt timp.</p>
        <button
          onClick={() => setDone(false)}
          className="mt-6 text-sm font-medium text-teal-600 hover:text-teal-700"
        >
          Trimite altă cerere
        </button>
      </div>
    );
  }

  return (
    <form
      className="space-y-4"
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
      <div className={`grid grid-cols-1 gap-4 ${compact ? 'md:grid-cols-2' : 'md:grid-cols-2'}`}>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">Nume complet *</label>
          <input
            required
            className={inputClasses}
            placeholder={t('name')}
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">Telefon *</label>
          <input
            required
            className={inputClasses}
            placeholder={t('phone')}
            value={form.phone}
            onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">Email *</label>
          <input
            required
            type="email"
            className={inputClasses}
            placeholder={t('email')}
            value={form.email}
            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">Nume asociație</label>
          <input
            className={inputClasses}
            placeholder={t('associationName')}
            value={form.associationName}
            onChange={(e) => setForm((p) => ({ ...p, associationName: e.target.value }))}
          />
        </div>
        {!compact && (
          <>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Nr. apartamente</label>
              <input
                type="number"
                className={inputClasses}
                placeholder={t('apartmentsCount')}
                value={form.apartmentsCount}
                onChange={(e) => setForm((p) => ({ ...p, apartmentsCount: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Data preferată</label>
              <input
                type="date"
                className={inputClasses}
                placeholder={t('preferredDate')}
                value={form.preferredDate}
                onChange={(e) => setForm((p) => ({ ...p, preferredDate: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-sm font-medium text-gray-700">Ora preferată</label>
              <input
                type="time"
                className={inputClasses}
                placeholder={t('preferredTime')}
                value={form.preferredTime}
                onChange={(e) => setForm((p) => ({ ...p, preferredTime: e.target.value }))}
              />
            </div>
          </>
        )}
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-700">Mesaj</label>
        <textarea
          className="min-h-[120px] w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 transition-all focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          placeholder={t('message')}
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
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-teal-600/20 transition hover:bg-teal-700 disabled:opacity-60"
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
    </form>
  );
}
