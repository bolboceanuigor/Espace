'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CalendarDays, Megaphone, PlusCircle, Tag } from 'lucide-react';
import { Badge, Card, Modal, ModalBody, ModalFooter, ModalHeader, PageHeader } from '@/components/ui';
import { announcementsApi, apartmentsApi } from '@/lib/api';
import { adminAnnouncements, announcementCategoryVariant, normalizeApiAnnouncement, type AdminAnnouncement } from '@/lib/admin-mvp-data';
import { useLocalizedPath } from '@/lib/use-localized-path';

const categoryLabels = {
  GENERAL: 'General',
  REPAIR: 'Reparații',
  URGENT: 'Urgent',
  ADMINISTRATION: 'Administrare',
} as const;
const statusLabels = {
  ACTIVE: 'Activ',
  ARCHIVED: 'Arhivat',
} as const;
const emptyForm = {
  title: '',
  category: 'GENERAL' as keyof typeof categoryLabels,
  content: '',
  status: 'ACTIVE' as keyof typeof statusLabels,
};

export default function AdminAnnouncementsPage() {
  const localizedPath = useLocalizedPath();
  const [rows, setRows] = useState<AdminAnnouncement[]>(adminAnnouncements);
  const [source, setSource] = useState<'api' | 'mock'>('mock');
  const [organizationId, setOrganizationId] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [isCreating, setIsCreating] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const loadAnnouncements = async () => {
    const [announcementRes, apartmentRes] = await Promise.all([
      announcementsApi.list(),
      apartmentsApi.list().catch(() => ({ data: [] })),
    ]);
    const apiRows = (announcementRes.data || []).map(normalizeApiAnnouncement);
    const fallbackOrganizationId = announcementRes.data?.[0]?.organizationId || apartmentRes.data?.[0]?.organizationId || '';
    if (apiRows.length) {
      setRows(apiRows);
      setSource('api');
    }
    setOrganizationId(String(fallbackOrganizationId || ''));
  };

  useEffect(() => {
    let active = true;
    loadAnnouncements().catch(() => {
        if (!active) return;
        setRows(adminAnnouncements);
        setSource('mock');
      });
    return () => {
      active = false;
    };
  }, []);

  const createAnnouncement = async () => {
    setFormError('');
    setSuccessMessage('');
    if (!organizationId) {
      setFormError('Nu am găsit organizația reală pentru publicare.');
      return;
    }
    if (!form.title.trim() || !form.content.trim()) {
      setFormError('Completează titlul și conținutul.');
      return;
    }

    setIsCreating(true);
    try {
      await announcementsApi.create({
        organizationId,
        title: form.title.trim(),
        content: form.content.trim(),
        category: form.category,
        status: form.status,
      });
      setModalOpen(false);
      setForm(emptyForm);
      setSuccessMessage('Anunțul a fost publicat.');
      setSource('api');
      await loadAnnouncements().catch(() => undefined);
    } catch {
      setFormError('Nu am putut publica anunțul.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        title="Avizier"
        description="Anunțuri oficiale pentru locatari, cu categorii clare și stare de publicare."
        rightSlot={
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs font-semibold text-muted-foreground">
              {source === 'api' ? 'Date reale' : 'Date demo'}
            </span>
            <button type="button" onClick={() => setModalOpen(true)} className="inline-flex min-h-10 items-center gap-2 rounded-2xl bg-foreground px-4 py-2 text-sm font-semibold text-background">
              <PlusCircle className="h-4 w-4" /> Adaugă anunț
            </button>
          </div>
        }
      />

      {successMessage ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          {successMessage}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {['General', 'Reparații', 'Urgent', 'Administrare'].map((category) => (
          <span key={category} className="shrink-0 rounded-full border border-border/70 bg-white px-3 py-2 text-sm font-semibold text-muted-foreground">
            {category}
          </span>
        ))}
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((item) => (
          <Card key={item.id} className={`p-4 ${item.category === 'Urgent' ? 'border-rose-200 bg-rose-50/35' : item.category === 'Reparații' ? 'border-amber-200 bg-amber-50/35' : ''}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-white/80 px-2 py-1">
                    <Tag className="h-3 w-3" />
                    {item.category}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="h-3 w-3" />
                    {item.date}
                  </span>
                </div>
                <h2 className="mt-3 text-base font-semibold text-foreground">{item.title}</h2>
              </div>
              <Badge variant={announcementCategoryVariant[item.category]}>{item.category}</Badge>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.preview}</p>
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/60 pt-3">
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Megaphone className="h-3.5 w-3.5" />
                {item.status}
              </span>
              <Link href={localizedPath(`/admin/announcements/${item.id}`)} className="inline-flex min-h-10 items-center rounded-xl border border-border/70 px-3 text-xs font-semibold hover:bg-muted/60">
                Deschide
              </Link>
            </div>
          </Card>
        ))}
      </section>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} maxWidth="2xl">
        <ModalHeader title="Adaugă anunț" onClose={() => setModalOpen(false)} />
        <ModalBody>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Titlu" value={form.title} onChange={(value) => setForm({ ...form, title: value })} required />
            <label className="block">
              <span className="label">Categorie</span>
              <select className="select" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as typeof form.category })}>
                {Object.entries(categoryLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label className="block md:col-span-2">
              <span className="label">Conținut *</span>
              <textarea className="input min-h-32 py-3" value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} />
            </label>
            <label className="block">
              <span className="label">Status</span>
              <select className="select" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as typeof form.status })}>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
          </div>
          {formError ? (
            <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
              {formError}
            </p>
          ) : null}
        </ModalBody>
        <ModalFooter>
          <button type="button" onClick={() => setModalOpen(false)} disabled={isCreating} className="rounded-2xl border border-border/70 px-4 py-2 text-sm font-semibold disabled:opacity-60">
            Anulează
          </button>
          <button type="button" onClick={createAnnouncement} disabled={isCreating} className="rounded-2xl bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-60">
            {isCreating ? 'Se publică...' : 'Publică anunț'}
          </button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

function Field({ label, value, onChange, required }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  return (
    <label className="block">
      <span className="label">{label}{required ? ' *' : ''}</span>
      <input className="input" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
