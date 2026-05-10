'use client';

import { FormEvent, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CalendarClock, Save, Send } from 'lucide-react';
import { Card, PageHeader } from '@/components/ui';
import { communicationsApi } from '@/lib/api';
import { useLocalizedPath } from '@/lib/use-localized-path';

const categories = [
  ['GENERAL', 'General'],
  ['MAINTENANCE', 'Mentenanță'],
  ['PAYMENTS', 'Plăți'],
  ['EMERGENCY', 'Urgență'],
  ['MEETING', 'Ședință'],
  ['DOCUMENTS', 'Documente'],
  ['OTHER', 'Altul'],
] as const;

const priorities = [
  ['LOW', 'Scăzută'],
  ['NORMAL', 'Normală'],
  ['HIGH', 'Importantă'],
  ['URGENT', 'Urgentă'],
] as const;

const statuses = [
  ['DRAFT', 'Draft'],
  ['SCHEDULED', 'Programat'],
  ['PUBLISHED', 'Publicat'],
] as const;

const visibilities = [
  ['ALL_RESIDENTS', 'Toată asociația'],
  ['BY_STAIRCASE', 'După scară'],
  ['BY_APARTMENTS', 'Apartamente selectate'],
  ['BY_ROLE', 'După rol'],
] as const;

const roles = [
  ['OWNER', 'Proprietar'],
  ['TENANT', 'Chiriaș'],
  ['RESIDENT', 'Locatar'],
  ['REPRESENTATIVE', 'Reprezentant'],
] as const;

type AnnouncementFormState = {
  title: string;
  excerpt: string;
  body: string;
  category: string;
  priority: string;
  status: string;
  publishAt: string;
  expiresAt: string;
  pinned: boolean;
  visibleToResidents: boolean;
  visibilityType: string;
  staircaseIds: string;
  apartmentIds: string;
  roles: string[];
};

const emptyForm: AnnouncementFormState = {
  title: '',
  excerpt: '',
  body: '',
  category: 'GENERAL',
  priority: 'NORMAL',
  status: 'DRAFT',
  publishAt: '',
  expiresAt: '',
  pinned: false,
  visibleToResidents: true,
  visibilityType: 'ALL_RESIDENTS',
  staircaseIds: '',
  apartmentIds: '',
  roles: [],
};

function toDatetimeLocal(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function splitValues(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function AnnouncementForm({ mode, initial }: { mode: 'create' | 'edit'; initial?: any }) {
  const router = useRouter();
  const localizedPath = useLocalizedPath();
  const [form, setForm] = useState<AnnouncementFormState>(() => ({
    ...emptyForm,
    title: initial?.title || '',
    excerpt: initial?.excerpt || '',
    body: initial?.body || initial?.content || '',
    category: initial?.category || 'GENERAL',
    priority: initial?.priority || 'NORMAL',
    status: initial?.status === 'ARCHIVED' ? 'DRAFT' : initial?.status || 'DRAFT',
    publishAt: toDatetimeLocal(initial?.publishAt),
    expiresAt: toDatetimeLocal(initial?.expiresAt),
    pinned: Boolean(initial?.pinned),
    visibleToResidents: initial?.visibleToResidents !== false,
    visibilityType: initial?.visibilityType || 'ALL_RESIDENTS',
    staircaseIds: (initial?.targets?.staircaseIds || []).join(', '),
    apartmentIds: (initial?.targets?.apartmentIds || []).join(', '),
    roles: initial?.targets?.roles || [],
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const targetHint = useMemo(() => {
    if (form.visibilityType === 'BY_STAIRCASE') return 'Introdu scările separate prin virgulă, de exemplu: Scara 1, Scara 2 sau ID-uri de scară.';
    if (form.visibilityType === 'BY_APARTMENTS') return 'Introdu ID-urile apartamentelor separate prin virgulă. Selecția avansată va fi conectată ulterior.';
    if (form.visibilityType === 'BY_ROLE') return 'Alege rolurile care vor vedea anunțul.';
    return 'Anunțul va fi vizibil pentru toți locatarii eligibili ai asociației.';
  }, [form.visibilityType]);

  const submit = async (event: FormEvent, forcedStatus?: string) => {
    event.preventDefault();
    setError('');
    if (!form.title.trim()) {
      setError('Titlul anunțului este obligatoriu.');
      return;
    }
    if (!form.body.trim()) {
      setError('Conținutul anunțului este obligatoriu.');
      return;
    }
    const status = forcedStatus || form.status;
    if (status === 'SCHEDULED' && !form.publishAt) {
      setError('Data publicării este obligatorie pentru anunțurile programate.');
      return;
    }
    if (form.visibilityType === 'BY_STAIRCASE' && !splitValues(form.staircaseIds).length) {
      setError('Selectează cel puțin o scară.');
      return;
    }
    if (form.visibilityType === 'BY_APARTMENTS' && !splitValues(form.apartmentIds).length) {
      setError('Selectează cel puțin un apartament.');
      return;
    }
    if (form.visibilityType === 'BY_ROLE' && !form.roles.length) {
      setError('Selectează cel puțin un rol.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        excerpt: form.excerpt.trim(),
        body: form.body.trim(),
        category: form.category,
        priority: form.priority,
        status,
        publishAt: form.publishAt || null,
        expiresAt: form.expiresAt || null,
        pinned: form.pinned,
        visibleToResidents: form.visibleToResidents,
        visibilityType: form.visibilityType,
        staircaseIds: splitValues(form.staircaseIds),
        apartmentIds: splitValues(form.apartmentIds),
        roles: form.roles,
      };
      const response =
        mode === 'edit' && initial?.id
          ? await communicationsApi.updateAdminAnnouncement(initial.id, payload)
          : await communicationsApi.createAdminAnnouncement(payload);
      const id = response.data?.id || response.data?.announcement?.id || initial?.id;
      router.push(localizedPath(`/admin/announcements/${id}`));
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut salva anunțul.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 pb-6">
      <PageHeader
        title={mode === 'edit' ? 'Editează anunț' : 'Creează anunț'}
        description="Pregătește anunțuri pentru avizierul locatarilor. SMS, email și push rămân neconectate în acest pas."
        rightSlot={
          <Link href={localizedPath('/admin/announcements')} className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-border/70 px-4 text-sm font-semibold hover:bg-muted/60">
            <ArrowLeft className="h-4 w-4" />
            Înapoi
          </Link>
        }
      />

      <form className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]" onSubmit={(event) => submit(event)}>
        <Card className="space-y-4 p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block md:col-span-2">
              <span className="label">Titlu *</span>
              <input className="input" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
            </label>
            <label className="block md:col-span-2">
              <span className="label">Rezumat</span>
              <input className="input" value={form.excerpt} onChange={(event) => setForm({ ...form, excerpt: event.target.value })} />
            </label>
            <label className="block md:col-span-2">
              <span className="label">Conținut *</span>
              <textarea className="input min-h-48 py-3" value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} />
            </label>
            <Select label="Categorie" value={form.category} values={categories} onChange={(value) => setForm({ ...form, category: value })} />
            <Select label="Prioritate" value={form.priority} values={priorities} onChange={(value) => setForm({ ...form, priority: value })} />
            <Select label="Status" value={form.status} values={statuses} onChange={(value) => setForm({ ...form, status: value })} />
            <Select label="Vizibilitate" value={form.visibilityType} values={visibilities} onChange={(value) => setForm({ ...form, visibilityType: value })} />
            <label className="block">
              <span className="label">Publicare la</span>
              <input type="datetime-local" className="input" value={form.publishAt} onChange={(event) => setForm({ ...form, publishAt: event.target.value })} />
            </label>
            <label className="block">
              <span className="label">Expiră la</span>
              <input type="datetime-local" className="input" value={form.expiresAt} onChange={(event) => setForm({ ...form, expiresAt: event.target.value })} />
            </label>
          </div>

          <div className="rounded-2xl border border-border/70 bg-muted/25 p-4">
            <p className="text-sm font-semibold text-foreground">Targetare</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{targetHint}</p>
            {form.visibilityType === 'BY_STAIRCASE' ? (
              <label className="mt-3 block">
                <span className="label">Scări</span>
                <input className="input" value={form.staircaseIds} onChange={(event) => setForm({ ...form, staircaseIds: event.target.value })} placeholder="Scara 1, Scara 2" />
              </label>
            ) : null}
            {form.visibilityType === 'BY_APARTMENTS' ? (
              <label className="mt-3 block">
                <span className="label">Apartamente</span>
                <input className="input" value={form.apartmentIds} onChange={(event) => setForm({ ...form, apartmentIds: event.target.value })} placeholder="ID apartament, ID apartament" />
              </label>
            ) : null}
            {form.visibilityType === 'BY_ROLE' ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {roles.map(([value, label]) => (
                  <label key={value} className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-border/70 bg-white px-3 text-sm font-semibold">
                    <input
                      type="checkbox"
                      checked={form.roles.includes(value)}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          roles: event.target.checked ? [...form.roles, value] : form.roles.filter((item) => item !== value),
                        })
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-dashed border-border/80 bg-white/70 p-4 text-sm text-muted-foreground">
            Atașamentele vor fi conectate ulterior. În acest pas anunțul se salvează ca text în aplicație.
          </div>

          {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}
        </Card>

        <aside className="space-y-4">
          <Card className="space-y-3 p-4">
            <p className="text-sm font-semibold text-foreground">Setări publicare</p>
            <label className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 px-3 py-2 text-sm font-semibold">
              Fixat sus
              <input type="checkbox" checked={form.pinned} onChange={(event) => setForm({ ...form, pinned: event.target.checked })} />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 px-3 py-2 text-sm font-semibold">
              Vizibil locatarilor
              <input type="checkbox" checked={form.visibleToResidents} onChange={(event) => setForm({ ...form, visibleToResidents: event.target.checked })} />
            </label>
          </Card>

          <Card className="space-y-3 p-4">
            <button type="submit" disabled={saving} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-60">
              <Save className="h-4 w-4" />
              {saving ? 'Se salvează...' : 'Salvează'}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={(event) => submit(event as unknown as FormEvent, 'DRAFT')}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-border/70 px-4 text-sm font-semibold hover:bg-muted/60 disabled:opacity-60"
            >
              <CalendarClock className="h-4 w-4" />
              Salvează draft
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={(event) => submit(event as unknown as FormEvent, 'PUBLISHED')}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-60"
            >
              <Send className="h-4 w-4" />
              Publică
            </button>
          </Card>
        </aside>
      </form>
    </div>
  );
}

function Select({
  label,
  value,
  values,
  onChange,
}: {
  label: string;
  value: string;
  values: readonly (readonly [string, string])[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <select className="select" value={value} onChange={(event) => onChange(event.target.value)}>
        {values.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}
