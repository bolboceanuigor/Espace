'use client';

import { FormEvent, useState } from 'react';
import { PlusCircle, Wrench } from 'lucide-react';
import { Badge, Button, Card, Input, PageHeader, StatCard } from '@/components/ui';
import Modal, { ModalBody, ModalFooter, ModalHeader } from '@/components/ui/Modal';

type RequestStatus = 'nouă' | 'în lucru' | 'rezolvată';

const initialRequests = [
  { id: 'r1', title: 'Verificare presiune apă caldă', category: 'Apă caldă', date: '30 Apr 2026', status: 'în lucru' as RequestStatus },
  { id: 'r2', title: 'Bec ars pe coridor', category: 'Spații comune', date: '24 Apr 2026', status: 'rezolvată' as RequestStatus },
];

const statusVariant: Record<RequestStatus, 'default' | 'warning' | 'success'> = {
  nouă: 'default',
  'în lucru': 'warning',
  rezolvată: 'success',
};

export default function ResidentIssuesPage() {
  const [requests, setRequests] = useState(initialRequests);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', category: 'General', message: '' });

  const create = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.title.trim()) return;
    setRequests((current) => [{ id: `local-${Date.now()}`, title: form.title, category: form.category, date: new Date().toLocaleDateString('ro-RO'), status: 'nouă' }, ...current]);
    setForm({ title: '', category: 'General', message: '' });
    setOpen(false);
  };

  return (
    <div className="space-y-5 pb-4">
      <PageHeader title="Cereri" description="Trimite și urmărește solicitările pentru apartamentul tău." rightSlot={<Button onClick={() => setOpen(true)}><PlusCircle className="h-4 w-4" /> Cerere nouă</Button>} />
      <section className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Total" value={requests.length} description="Cereri trimise" icon={<Wrench className="h-5 w-5" />} />
        <StatCard label="Deschise" value={requests.filter((item) => item.status !== 'rezolvată').length} description="În atenția administrației" icon={<Wrench className="h-5 w-5" />} tone="warning" />
        <StatCard label="Rezolvate" value={requests.filter((item) => item.status === 'rezolvată').length} description="Finalizate" icon={<Wrench className="h-5 w-5" />} tone="success" />
      </section>
      <section className="grid gap-3">
        {requests.map((request) => (
          <Card key={request.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div><h2 className="font-semibold text-foreground">{request.title}</h2><p className="mt-1 text-sm text-muted-foreground">{request.category} · {request.date}</p></div>
              <Badge variant={statusVariant[request.status]}>{request.status}</Badge>
            </div>
          </Card>
        ))}
      </section>
      <Modal isOpen={open} onClose={() => setOpen(false)} maxWidth="lg">
        <form onSubmit={create}>
          <ModalHeader title="Cerere nouă" onClose={() => setOpen(false)} />
          <ModalBody className="space-y-4">
            <Input label="Titlu" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required />
            <Input label="Categorie" value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} />
            <label className="block space-y-1.5 text-sm font-medium text-foreground">
              Detalii
              <textarea className="min-h-32 w-full rounded-2xl border border-border/70 bg-white p-4 text-sm outline-none" value={form.message} onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))} />
            </label>
          </ModalBody>
          <ModalFooter><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Anulează</Button><Button type="submit">Trimite</Button></ModalFooter>
        </form>
      </Modal>
    </div>
  );
}
