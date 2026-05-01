'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, Megaphone, PlusCircle, ShieldCheck, Tag } from 'lucide-react';
import EmptyState from '@/components/common/EmptyState';
import LoadingState from '@/components/common/LoadingState';
import Button from '@/components/ui/Button';
import Modal, { ModalBody, ModalFooter, ModalHeader } from '@/components/ui/Modal';

export type AvizierPriority = 'NORMAL' | 'IMPORTANT' | 'URGENT';
export type AvizierCategory = 'ANNOUNCEMENT' | 'DOCUMENT' | 'MAINTENANCE' | 'SYSTEM_NOTICE';

export type AvizierAnnouncement = {
  id: string;
  title: string;
  content: string;
  contentType?: AvizierCategory | string;
  category?: string;
  importance?: AvizierPriority | string;
  priority?: AvizierPriority | string;
  targetType?: string;
  status?: string;
  isPinned?: boolean;
  commentsEnabled?: boolean;
  createdAt?: string;
  updatedAt?: string;
  _count?: {
    comments?: number;
  };
};

type AvizierForm = {
  title: string;
  category: AvizierCategory;
  content: string;
  priority: AvizierPriority;
};

type AvizierPageProps = {
  description: string;
  loadAnnouncements: () => Promise<AvizierAnnouncement[]>;
  createAnnouncement?: (data: AvizierForm) => Promise<AvizierAnnouncement | null | void>;
  canPersistCreate?: boolean;
};

const CATEGORY_LABELS: Record<string, string> = {
  ANNOUNCEMENT: 'General',
  DOCUMENT: 'Documente',
  MAINTENANCE: 'Mentenanță',
  SYSTEM_NOTICE: 'Informare',
};

const PRIORITY_LABELS: Record<string, string> = {
  NORMAL: 'Normal',
  IMPORTANT: 'Important',
  URGENT: 'Urgent',
};

const FALLBACK_ANNOUNCEMENTS: AvizierAnnouncement[] = [
  {
    id: 'fallback-1',
    title: 'Bun venit în Avizier',
    content: 'Aici vor apărea anunțurile importante pentru comunitate.',
    contentType: 'ANNOUNCEMENT',
    importance: 'IMPORTANT',
    status: 'Publicat',
    createdAt: new Date().toISOString(),
  },
];

const emptyForm: AvizierForm = {
  title: '',
  category: 'ANNOUNCEMENT',
  content: '',
  priority: 'NORMAL',
};

function normalizeRows(rows: AvizierAnnouncement[]) {
  return rows.map((row) => ({
    ...row,
    contentType: row.contentType || row.category || 'ANNOUNCEMENT',
    importance: row.importance || row.priority || 'NORMAL',
    status: row.status || (row.isPinned ? 'Fixat' : 'Publicat'),
    createdAt: row.createdAt || row.updatedAt || new Date().toISOString(),
  }));
}

function localAnnouncement(form: AvizierForm): AvizierAnnouncement {
  return {
    id: `local-${Date.now()}`,
    title: form.title,
    content: form.content,
    contentType: form.category,
    importance: form.priority,
    status: 'Local',
    createdAt: new Date().toISOString(),
  };
}

function formatDate(value?: string) {
  if (!value) return 'Astăzi';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Astăzi';
  return new Intl.DateTimeFormat('ro-RO', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function priorityClasses(priority?: string) {
  if (priority === 'URGENT') return 'border-rose-200 bg-rose-50 text-rose-700';
  if (priority === 'IMPORTANT') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function cardClasses(priority?: string) {
  if (priority === 'URGENT') return 'border-rose-200 bg-gradient-to-br from-white to-rose-50/70';
  if (priority === 'IMPORTANT') return 'border-amber-200 bg-gradient-to-br from-white to-amber-50/70';
  return 'border-border/70 bg-card';
}

export default function AvizierPage({ description, loadAnnouncements, createAnnouncement, canPersistCreate = false }: AvizierPageProps) {
  const [rows, setRows] = useState<AvizierAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState<AvizierForm>(emptyForm);

  const announcements = useMemo(() => normalizeRows(rows), [rows]);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await loadAnnouncements();
        if (!isMounted) return;
        setRows(data.length ? data : []);
      } catch {
        if (!isMounted) return;
        setRows(FALLBACK_ANNOUNCEMENTS);
        setError('Nu am putut încărca anunțurile din API. Afișăm temporar date locale.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    load().catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, [loadAnnouncements]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.title.trim() || !form.content.trim()) return;

    setIsSubmitting(true);
    const fallback = localAnnouncement(form);
    try {
      const created = createAnnouncement ? await createAnnouncement(form) : null;
      setRows((current) => [created || fallback, ...current]);
      setError(created || !canPersistCreate ? null : 'Anunțul a fost adăugat local. API-ul nu a returnat un răspuns publicabil.');
    } catch {
      setRows((current) => [fallback, ...current]);
      setError('Anunțul a fost adăugat local. Salvarea în API nu este disponibilă momentan.');
    } finally {
      setForm(emptyForm);
      setIsModalOpen(false);
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-5 overflow-x-hidden pb-24 md:space-y-6 md:pb-8">
      <section className="rounded-[1.75rem] border border-border/70 bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] md:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/60 px-3 py-1 text-xs font-semibold text-muted-foreground">
              <Megaphone className="h-3.5 w-3.5" />
              Avizier
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-4xl">Avizier</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">{description}</p>
          </div>
          <Button onClick={() => setIsModalOpen(true)} className="w-full bg-foreground text-background shadow-[0_14px_34px_rgba(15,23,42,0.16)] hover:bg-foreground/90 sm:w-auto">
            <PlusCircle className="h-4 w-4" />
            Adaugă anunț
          </Button>
        </div>
      </section>

      {error ? (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {loading ? <LoadingState label="Se încarcă avizierul..." /> : null}

      {!loading && !announcements.length ? (
        <EmptyState title="Nu există anunțuri încă." actionLabel="Adaugă anunț" onAction={() => setIsModalOpen(true)} />
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {announcements.map((item) => {
          const priority = String(item.importance || 'NORMAL');
          const category = String(item.contentType || 'ANNOUNCEMENT');
          return (
            <article key={item.id} className={`rounded-[1.35rem] border p-4 shadow-[0_14px_40px_rgba(15,23,42,0.045)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_54px_rgba(15,23,42,0.08)] ${cardClasses(priority)}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-white/80 px-2 py-1">
                      <Tag className="h-3 w-3" />
                      {CATEGORY_LABELS[category] || category}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" />
                      {formatDate(item.createdAt)}
                    </span>
                  </div>
                  <h2 className="mt-3 line-clamp-2 text-base font-semibold text-foreground">{item.title}</h2>
                </div>
                <span className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-semibold ${priorityClasses(priority)}`}>
                  {PRIORITY_LABELS[priority] || priority}
                </span>
              </div>

              <p className="mt-3 line-clamp-4 text-sm leading-6 text-muted-foreground">{item.content}</p>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {item.status}
                </span>
                {item._count?.comments !== undefined ? <span>{item._count.comments} comentarii</span> : null}
              </div>
            </article>
          );
        })}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} maxWidth="lg">
        <form onSubmit={handleSubmit}>
          <ModalHeader title="Adaugă anunț" onClose={() => setIsModalOpen(false)} />
          <ModalBody className="space-y-4">
            <label className="block text-sm font-medium text-foreground">
              Titlu
              <input
                className="input mt-1"
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Ex: Revizie lift"
                required
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-foreground">
                Categorie
                <select
                  className="select mt-1"
                  value={form.category}
                  onChange={(event) => setForm((current) => ({ ...current, category: event.target.value as AvizierCategory }))}
                >
                  <option value="ANNOUNCEMENT">General</option>
                  <option value="DOCUMENT">Documente</option>
                  <option value="MAINTENANCE">Mentenanță</option>
                  <option value="SYSTEM_NOTICE">Informare</option>
                </select>
              </label>
              <label className="block text-sm font-medium text-foreground">
                Prioritate
                <select
                  className="select mt-1"
                  value={form.priority}
                  onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value as AvizierPriority }))}
                >
                  <option value="NORMAL">Normal</option>
                  <option value="IMPORTANT">Important</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </label>
            </div>
            <label className="block text-sm font-medium text-foreground">
              Mesaj
              <textarea
                className="input mt-1 min-h-[140px]"
                value={form.content}
                onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))}
                placeholder="Scrie mesajul pentru locatari..."
                required
              />
            </label>
          </ModalBody>
          <ModalFooter>
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              Anulează
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Publică
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </div>
  );
}
