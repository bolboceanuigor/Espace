'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Button, Card, Input, PageHeader } from '@/components/ui';
import { residentDemoApi } from '@/lib/api';
import { residentProfile, type ResidentIssuePriority } from '@/lib/resident-mvp-data';
import { useLocalizedPath } from '@/lib/use-localized-path';

const categoryApiValues = {
  Apă: 'WATER',
  Încălzire: 'HEATING',
  Curățenie: 'CLEANING',
  Lift: 'ELEVATOR',
  Reparații: 'REPAIR',
  Altele: 'OTHER',
} as const;

const priorityApiValues = {
  Normal: 'NORMAL',
  Important: 'IMPORTANT',
  Urgent: 'URGENT',
} as const;

export default function ResidentIssueCreatePage() {
  const router = useRouter();
  const localizedPath = useLocalizedPath();
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    category: 'Apă' as keyof typeof categoryApiValues,
    title: '',
    description: '',
    priority: 'Normal' as ResidentIssuePriority,
    apartmentInfo: `${residentProfile.apartment}, ${residentProfile.staircase}`,
  });

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.title.trim() || !form.description.trim()) return;
    setError('');
    setIsSubmitting(true);
    try {
      await residentDemoApi.createIssue({
        category: categoryApiValues[form.category],
        priority: priorityApiValues[form.priority],
        title: form.title.trim(),
        description: form.description.trim(),
      });
      setSubmitted(true);
      setForm((current) => ({ ...current, title: '', description: '' }));
      window.setTimeout(() => router.push(localizedPath('/resident/issues')), 650);
    } catch {
      setError('Nu am putut trimite cererea.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5 pb-4">
      <Link href={localizedPath('/resident/issues')} className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Înapoi la cereri
      </Link>
      <PageHeader title="Cerere nouă" description="Descrie problema pentru administrație." />

      {submitted ? (
        <Card className="border-emerald-200 bg-emerald-50/70">
          <p className="inline-flex items-center gap-2 font-semibold text-emerald-800">
            <CheckCircle2 className="h-5 w-5" />
            Cererea a fost trimisă.
          </p>
          <p className="mt-2 text-sm text-emerald-700">Te redirecționăm către lista de cereri.</p>
        </Card>
      ) : null}
      {error ? (
        <Card className="border-rose-200 bg-rose-50/70">
          <p className="font-semibold text-rose-800">{error}</p>
        </Card>
      ) : null}

      <Card>
        <form onSubmit={submit} className="space-y-4">
          <label className="block space-y-1.5 text-sm font-medium text-foreground">
            Categorie
            <select className="h-11 w-full rounded-2xl border border-border/70 bg-white px-3 text-sm outline-none" value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value as keyof typeof categoryApiValues }))}>
              {Object.keys(categoryApiValues).map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <Input label="Titlu" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Ex: Presiune mică la apă caldă" required />
          <label className="block space-y-1.5 text-sm font-medium text-foreground">
            Descriere
            <textarea
              className="min-h-36 w-full rounded-2xl border border-border/70 bg-white p-4 text-sm outline-none focus:ring-2 focus:ring-foreground/10"
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="Scrie pe scurt ce se întâmplă..."
              required
            />
          </label>
          <label className="block space-y-1.5 text-sm font-medium text-foreground">
            Prioritate
            <select className="h-11 w-full rounded-2xl border border-border/70 bg-white px-3 text-sm outline-none" value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value as ResidentIssuePriority }))}>
              {['Normal', 'Important', 'Urgent'].map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <Input label="Apartament" value={form.apartmentInfo} onChange={(event) => setForm((current) => ({ ...current, apartmentInfo: event.target.value }))} />
          <Button type="submit" disabled={isSubmitting} className="w-full">{isSubmitting ? 'Se trimite...' : 'Trimite cerere'}</Button>
        </form>
      </Card>
    </div>
  );
}
