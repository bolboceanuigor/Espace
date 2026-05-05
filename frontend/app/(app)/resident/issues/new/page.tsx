'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Button, Card, Input, PageHeader } from '@/components/ui';
import { residentProfile, type ResidentIssuePriority } from '@/lib/resident-mvp-data';

export default function ResidentIssueCreatePage() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    category: 'Apă',
    title: '',
    description: '',
    priority: 'Normal' as ResidentIssuePriority,
    apartmentInfo: `${residentProfile.apartment}, ${residentProfile.staircase}`,
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.title.trim() || !form.description.trim()) return;
    setSubmitted(true);
    setForm((current) => ({ ...current, title: '', description: '' }));
  };

  return (
    <div className="space-y-5 pb-4">
      <Link href="/resident/issues" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Înapoi la cereri
      </Link>
      <PageHeader title="Cerere nouă" description="Descrie problema pentru administrație." />

      {submitted ? (
        <Card className="border-emerald-200 bg-emerald-50/70">
          <p className="inline-flex items-center gap-2 font-semibold text-emerald-800">
            <CheckCircle2 className="h-5 w-5" />
            Cererea a fost salvată local pentru demo.
          </p>
          <p className="mt-2 text-sm text-emerald-700">Conectarea la backend va trimite cererea către administrator.</p>
        </Card>
      ) : null}

      <Card>
        <form onSubmit={submit} className="space-y-4">
          <label className="block space-y-1.5 text-sm font-medium text-foreground">
            Categorie
            <select className="h-11 w-full rounded-2xl border border-border/70 bg-white px-3 text-sm outline-none" value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}>
              {['Apă', 'Încălzire', 'Curățenie', 'Lift', 'Reparații', 'Altele'].map((item) => <option key={item} value={item}>{item}</option>)}
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
          <Button type="submit" className="w-full">Trimite cerere</Button>
        </form>
      </Card>
    </div>
  );
}
