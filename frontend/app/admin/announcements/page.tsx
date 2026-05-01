'use client';

import { FormEvent, useState } from 'react';
import { CalendarDays, Megaphone, PlusCircle, Tag } from 'lucide-react';
import { Badge, Button, Card, Input, PageHeader } from '@/components/ui';
import Modal, { ModalBody, ModalFooter, ModalHeader } from '@/components/ui/Modal';

type Priority = 'normal' | 'important' | 'urgent';

const initialAnnouncements = [
  { id: 'ann-1', title: 'Lucrări de întreținere la lift', category: 'Mentenanță', date: '03 Mai 2026', content: 'Liftul de pe Scara 2 va fi verificat între orele 10:00 și 13:00.', priority: 'important' as Priority, status: 'Publicat' },
  { id: 'ann-2', title: 'Ședință APC - buget lunar', category: 'Comunitate', date: '08 Mai 2026', content: 'Locatarii sunt invitați la ședința lunară pentru aprobarea cheltuielilor comune.', priority: 'normal' as Priority, status: 'Publicat' },
  { id: 'ann-3', title: 'Avarie apă caldă pe Scara 3', category: 'Urgent', date: '01 Mai 2026', content: 'Echipa tehnică investighează întreruperea. Revenim cu actualizări.', priority: 'urgent' as Priority, status: 'Publicat' },
];

const priorityVariant: Record<Priority, 'neutral' | 'warning' | 'error'> = {
  normal: 'neutral',
  important: 'warning',
  urgent: 'error',
};

export default function AdminAnnouncementsPage() {
  const [rows, setRows] = useState(initialAnnouncements);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', category: 'General', content: '', priority: 'normal' as Priority });

  const create = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.title.trim() || !form.content.trim()) return;
    setRows((current) => [{
      id: `local-${Date.now()}`,
      title: form.title,
      category: form.category,
      content: form.content,
      priority: form.priority,
      status: 'Local',
      date: new Date().toLocaleDateString('ro-RO', { day: '2-digit', month: 'short', year: 'numeric' }),
    }, ...current]);
    setForm({ title: '', category: 'General', content: '', priority: 'normal' });
    setOpen(false);
  };

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        title="Avizier"
        description="Anunțuri oficiale pentru locatari, cu priorități clare și conținut ușor de urmărit."
        rightSlot={<Button onClick={() => setOpen(true)}><PlusCircle className="h-4 w-4" /> Adaugă anunț</Button>}
      />
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((item) => (
          <Card key={item.id} className={`p-4 ${item.priority === 'urgent' ? 'border-rose-200 bg-rose-50/35' : item.priority === 'important' ? 'border-amber-200 bg-amber-50/35' : ''}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-white/80 px-2 py-1"><Tag className="h-3 w-3" />{item.category}</span>
                  <span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" />{item.date}</span>
                </div>
                <h2 className="mt-3 text-base font-semibold text-foreground">{item.title}</h2>
              </div>
              <Badge variant={priorityVariant[item.priority]}>{item.priority}</Badge>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.content}</p>
            <p className="mt-4 inline-flex items-center gap-1 border-t border-border/60 pt-3 text-xs text-muted-foreground"><Megaphone className="h-3.5 w-3.5" /> {item.status}</p>
          </Card>
        ))}
      </section>
      <Modal isOpen={open} onClose={() => setOpen(false)} maxWidth="lg">
        <form onSubmit={create}>
          <ModalHeader title="Adaugă anunț" onClose={() => setOpen(false)} />
          <ModalBody className="space-y-4">
            <Input label="Titlu" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Categorie" value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} />
              <label className="block space-y-1.5 text-sm font-medium text-foreground">
                Prioritate
                <select className="h-11 w-full rounded-2xl border border-border/70 bg-white px-3 text-sm outline-none" value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value as Priority }))}>
                  <option value="normal">normal</option>
                  <option value="important">important</option>
                  <option value="urgent">urgent</option>
                </select>
              </label>
            </div>
            <label className="block space-y-1.5 text-sm font-medium text-foreground">
              Mesaj
              <textarea className="min-h-36 w-full rounded-2xl border border-border/70 bg-white p-4 text-sm outline-none" value={form.content} onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))} required />
            </label>
          </ModalBody>
          <ModalFooter><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Anulează</Button><Button type="submit">Publică</Button></ModalFooter>
        </form>
      </Modal>
    </div>
  );
}
