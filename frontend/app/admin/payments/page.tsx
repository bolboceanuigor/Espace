'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, Clock3, CreditCard, ReceiptText } from 'lucide-react';
import { Badge, Button, Card, PageHeader, StatCard } from '@/components/ui';
import Modal, { ModalBody, ModalFooter, ModalHeader } from '@/components/ui/Modal';
import { formatMdl } from '@/lib/condo-admin-fallback';

type PaymentStatus = 'Achitat' | 'Neachitat' | 'Întârziat';

const invoices = [
  { id: 'inv-45-04', apartment: 'Apt. 45', number: 'FAC-2026-04-045', description: 'Întreținere aprilie', amount: 1240, dueDate: '10 Mai 2026', status: 'Neachitat' as PaymentStatus },
  { id: 'inv-72-03', apartment: 'Apt. 72', number: 'FAC-2026-03-072', description: 'Servicii comunale martie', amount: 3860, dueDate: '10 Apr 2026', status: 'Întârziat' as PaymentStatus },
  { id: 'inv-18-04', apartment: 'Apt. 18', number: 'FAC-2026-04-018', description: 'Întreținere aprilie', amount: 1860, dueDate: '10 Mai 2026', status: 'Achitat' as PaymentStatus },
  { id: 'inv-11-04', apartment: 'Apt. 11', number: 'FAC-2026-04-011', description: 'Fond reparații', amount: 920, dueDate: '10 Mai 2026', status: 'Neachitat' as PaymentStatus },
];

const statusVariant: Record<PaymentStatus, 'success' | 'warning' | 'error'> = {
  Achitat: 'success',
  Neachitat: 'warning',
  Întârziat: 'error',
};

export default function AdminPaymentsPage() {
  const [filter, setFilter] = useState<'Toate' | PaymentStatus>('Toate');
  const [modalOpen, setModalOpen] = useState(false);
  const visible = useMemo(() => invoices.filter((invoice) => filter === 'Toate' || invoice.status === filter), [filter]);

  return (
    <div className="space-y-5 pb-4">
      <PageHeader title="Plăți" description="Facturi, restanțe și plăți pentru APC Alba Iulia 75." />
      <section className="grid gap-3 md:grid-cols-3">
        <StatCard label="Total de plată" value={formatMdl(6020)} description="Sold deschis" icon={<ReceiptText className="h-5 w-5" />} tone="warning" />
        <StatCard label="Restanțe" value={formatMdl(3860)} description="Facturi întârziate" icon={<Clock3 className="h-5 w-5" />} tone="danger" />
        <StatCard label="Achitat luna curentă" value={formatMdl(1860)} description="Plăți confirmate" icon={<CheckCircle2 className="h-5 w-5" />} tone="success" />
      </section>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {(['Toate', 'Achitat', 'Neachitat', 'Întârziat'] as const).map((item) => (
          <button key={item} type="button" onClick={() => setFilter(item)} className={`h-10 shrink-0 rounded-full border px-4 text-sm font-medium ${filter === item ? 'border-foreground bg-foreground text-background' : 'border-border/70 bg-white text-foreground hover:bg-muted/70'}`}>
            {item}
          </button>
        ))}
      </div>
      <section className="hidden overflow-hidden rounded-[1.35rem] border border-border/70 bg-white shadow-[0_14px_40px_rgba(15,23,42,0.045)] md:block">
        <div className="grid grid-cols-[1fr_1fr_1.2fr_0.8fr_0.8fr_auto] gap-3 border-b border-border/70 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span>Factura</span><span>Apartament</span><span>Descriere</span><span>Sumă</span><span>Status</span><span />
        </div>
        {visible.map((invoice) => (
          <div key={invoice.id} className="grid grid-cols-[1fr_1fr_1.2fr_0.8fr_0.8fr_auto] items-center gap-3 border-b border-border/50 px-4 py-4 text-sm last:border-b-0">
            <span className="font-semibold text-foreground">{invoice.number}</span>
            <span className="text-muted-foreground">{invoice.apartment}</span>
            <span className="text-muted-foreground">{invoice.description} · {invoice.dueDate}</span>
            <span className="font-semibold text-foreground">{formatMdl(invoice.amount)}</span>
            <Badge variant={statusVariant[invoice.status]}>{invoice.status}</Badge>
            {invoice.status !== 'Achitat' ? <Button size="sm" onClick={() => setModalOpen(true)}><CreditCard className="h-4 w-4" /> Achită</Button> : <span />}
          </div>
        ))}
      </section>
      <section className="grid gap-3 md:hidden">
        {visible.map((invoice) => (
          <Card key={invoice.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div><h2 className="font-semibold text-foreground">{invoice.number}</h2><p className="mt-1 text-sm text-muted-foreground">{invoice.apartment} · {invoice.description}</p></div>
              <Badge variant={statusVariant[invoice.status]}>{invoice.status}</Badge>
            </div>
            <div className="mt-4 flex items-center justify-between"><p className="text-xl font-semibold">{formatMdl(invoice.amount)}</p><p className="text-xs text-muted-foreground">{invoice.dueDate}</p></div>
            {invoice.status !== 'Achitat' ? <Button className="mt-4 w-full" onClick={() => setModalOpen(true)}>Achită</Button> : null}
          </Card>
        ))}
      </section>
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} maxWidth="md">
        <ModalHeader title="Achită" onClose={() => setModalOpen(false)} />
        <ModalBody><p className="text-sm text-muted-foreground">Integrarea de plată va fi conectată ulterior.</p></ModalBody>
        <ModalFooter><Button onClick={() => setModalOpen(false)}>Închide</Button></ModalFooter>
      </Modal>
    </div>
  );
}
