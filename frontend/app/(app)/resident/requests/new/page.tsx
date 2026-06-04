'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Info, Send } from 'lucide-react';
import { Button, Card, PageHeader } from '@/components/ui';
import LoadingState from '@/components/common/LoadingState';
import { requestsApi } from '@/lib/api';
import { useLocalizedPath } from '@/lib/use-localized-path';

const categoryLabels: Record<string, string> = {
  REPAIR: 'Reparație',
  WATER_LEAK: 'Scurgere apă',
  ELECTRICITY: 'Electricitate',
  ELEVATOR: 'Lift',
  CLEANING: 'Curățenie',
  HEATING: 'Încălzire',
  INTERCOM: 'Interfon',
  PARKING: 'Parcare',
  COURTYARD: 'Curte',
  DOCUMENTS: 'Documente',
  PAYMENT: 'Plăți',
  METER: 'Contoare',
  NEIGHBOR_ISSUE: 'Vecini / zgomot',
  GENERAL_QUESTION: 'Întrebare generală',
  OTHER: 'Altceva',
};

const priorityLabels: Record<string, string> = {
  LOW: 'Scăzută',
  NORMAL: 'Normală',
  HIGH: 'Înaltă',
  URGENT: 'Urgentă',
};

const contactLabels: Record<string, string> = {
  PHONE: 'Telefon',
  EMAIL: 'Email',
  APP: 'Aplicație',
  WHATSAPP: 'WhatsApp',
  TELEGRAM: 'Telegram',
};

type FormState = {
  apartmentId: string;
  title: string;
  category: string;
  priority: string;
  locationDetails: string;
  attachmentUrl: string;
  description: string;
  preferredContactMethod: string;
  confirmed: boolean;
};

const initialForm: FormState = {
  apartmentId: '',
  title: '',
  category: 'REPAIR',
  priority: 'NORMAL',
  locationDetails: '',
  attachmentUrl: '',
  description: '',
  preferredContactMethod: '',
  confirmed: false,
};

export default function ResidentRequestCreatePage() {
  const router = useRouter();
  const localizedPath = useLocalizedPath();
  const [apartments, setApartments] = useState<any[]>([]);
  const [association, setAssociation] = useState<any>(null);
  const [form, setForm] = useState<FormState>(initialForm);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const updateForm = (key: keyof FormState, value: string | boolean) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const loadContext = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await requestsApi.residentList({ limit: 1 });
      const nextApartments = response.data?.apartments || [];
      const preferredApartmentId =
        typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('apartmentId') || '' : '';
      const selectedApartmentId = nextApartments.some((apartment: any) => apartment.id === preferredApartmentId)
        ? preferredApartmentId
        : nextApartments[0]?.id || '';
      setApartments(nextApartments);
      setAssociation(response.data?.association || null);
      setForm((current) => ({ ...current, apartmentId: current.apartmentId || selectedApartmentId }));
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut încărca apartamentele asociate contului.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadContext();
  }, [loadContext]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.apartmentId) {
      setError('Apartamentul este obligatoriu.');
      return;
    }
    if (form.title.trim().length < 3) {
      setError('Titlul trebuie să aibă cel puțin 3 caractere.');
      return;
    }
    if (form.description.trim().length < 10) {
      setError('Descrierea trebuie să aibă cel puțin 10 caractere.');
      return;
    }
    if (!form.confirmed) {
      setError('Confirmă că ai descris problema cât mai clar.');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const response = await requestsApi.residentCreate({
        apartmentId: form.apartmentId,
        title: form.title.trim(),
        category: form.category,
        priority: form.priority,
        locationText: form.locationDetails.trim() || undefined,
        locationDetails: form.locationDetails.trim() || undefined,
        attachmentUrl: form.attachmentUrl.trim() || undefined,
        attachmentFileName: form.attachmentUrl.trim() ? 'Atașament solicitare' : undefined,
        attachmentMimeType: form.attachmentUrl.trim() ? 'link' : undefined,
        description: form.description.trim(),
        preferredContactMethod: form.preferredContactMethod || undefined,
      });
      setSuccess('Solicitarea a fost trimisă.');
      router.push(localizedPath(`/resident/requests/${response.data.id}`));
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut trimite solicitarea.'));
    } finally {
      setSubmitting(false);
    }
  };

  const hasApartments = apartments.length > 0;

  return (
    <div className="space-y-5 overflow-x-hidden pb-24 md:pb-6">
      <Link href={localizedPath('/resident/requests')} className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Înapoi la solicitări
      </Link>

      <PageHeader
        title="Creează solicitare"
        description="Trimite o problemă, întrebare sau cerere către administrația asociației."
        rightSlot={
          <span className="rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs font-semibold text-muted-foreground">
            {association?.shortName || 'A.P.C.'}
          </span>
        }
      />

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}
      {success ? (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          <CheckCircle2 className="h-4 w-4" />
          {success}
        </div>
      ) : null}
      {loading ? <LoadingState label="Se încarcă apartamentele..." rows={3} /> : null}

      {!loading && !hasApartments ? (
        <Card className="p-6">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-5 w-5 text-amber-600" />
            <div>
              <h2 className="font-semibold text-foreground">Nu ai un apartament asociat contului</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Pentru a trimite solicitări, contul tău trebuie legat de un apartament de către administratorul asociației.
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      {!loading && hasApartments ? (
        <Card className="p-5">
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-medium text-foreground">
                Apartament
                <select className="select" value={form.apartmentId} onChange={(event) => updateForm('apartmentId', event.target.value)} required>
                  {apartments.map((apartment) => (
                    <option key={apartment.id} value={apartment.id}>
                      Apartament {apartment.apartmentNumber}{apartment.staircase ? ` · Scara ${apartment.staircase}` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-foreground">
                Categorie
                <select className="select" value={form.category} onChange={(event) => updateForm('category', event.target.value)}>
                  {Object.entries(categoryLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-foreground">
                Prioritate
                <select className="select" value={form.priority} onChange={(event) => updateForm('priority', event.target.value)}>
                  {Object.entries(priorityLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-foreground">
                Metodă preferată contact
                <select className="select" value={form.preferredContactMethod} onChange={(event) => updateForm('preferredContactMethod', event.target.value)}>
                  <option value="">Nespecificat</option>
                  {Object.entries(contactLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="grid gap-1.5 text-sm font-medium text-foreground">
              Titlu
              <input className="input" value={form.title} onChange={(event) => updateForm('title', event.target.value)} placeholder="Ex: Problemă la iluminatul de pe scară" required />
            </label>

            <label className="grid gap-1.5 text-sm font-medium text-foreground">
              Locație, opțional
              <input className="input" value={form.locationDetails} onChange={(event) => updateForm('locationDetails', event.target.value)} placeholder="Ex: baie, subsol, scara 1, etaj 4" />
            </label>

            <label className="grid gap-1.5 text-sm font-medium text-foreground">
              Link poză / atașament, opțional
              <input className="input" value={form.attachmentUrl} onChange={(event) => updateForm('attachmentUrl', event.target.value)} placeholder="/uploads/..." />
              <span className="text-xs text-muted-foreground">Se acceptă doar fișiere încărcate prin Espace. Linkurile externe nu mai sunt permise.</span>
            </label>

            <label className="grid gap-1.5 text-sm font-medium text-foreground">
              Descriere
              <textarea
                className="min-h-40 w-full rounded-2xl border border-border/70 bg-white p-4 text-sm outline-none focus:ring-2 focus:ring-foreground/10"
                value={form.description}
                onChange={(event) => updateForm('description', event.target.value)}
                placeholder="Descrie pe scurt problema sau cererea."
                required
              />
            </label>

            <label className="flex items-start gap-2 rounded-2xl border border-border/70 bg-muted/30 p-4 text-sm font-medium text-foreground">
              <input type="checkbox" checked={form.confirmed} onChange={(event) => updateForm('confirmed', event.target.checked)} className="mt-1" />
              <span>Am descris problema cât mai clar.</span>
            </label>

            <Button type="submit" isLoading={submitting} disabled={submitting || !hasApartments} className="w-full sm:w-auto">
              <Send className="h-4 w-4" />
              Trimite solicitarea
            </Button>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
