'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, Clock3, CreditCard, ReceiptText } from 'lucide-react';
import { Badge, Button, Card, PageHeader, StatCard } from '@/components/ui';
import Modal, { ModalBody, ModalFooter, ModalHeader } from '@/components/ui/Modal';
import { formatMdl } from '@/lib/condo-admin-fallback';

type PaymentStatus = 'Achitat' | 'Neachitat' | 'Întârziat';

const invoices = [
  { id: 'i1', number: 'FAC-2026-04-045', month: 'Aprilie 2026', description: 'Întreținere și servicii comune', amount: 1240, dueDate: '10 Mai 2026', status: 'Neachitat' as PaymentStatus },
  { id: 'i2', number: 'FAC-2026-03-045', month: 'Martie 2026', description: 'Întreținere bloc', amount: 1160, dueDate: '10 Apr 2026', status: 'Achitat' as PaymentStatus },
  { id: 'i3', number: 'FAC-2026-02-045', month: 'Februarie 2026', description: 'Servicii comunale', amount: 980, dueDate: '10 Mar 2026', status: 'Achitat' as PaymentStatus },
];

const statusVariant: Record<PaymentStatus, 'success' | 'warning' | 'error'> = {
  Achitat: 'success',
  Neachitat: 'warning',
  Întârziat: 'error',
};

export default function ResidentPaymentsPage() {
  const [filter, setFilter] = useState<'Toate' | PaymentStatus>('Toate');
  const [modalOpen, setModalOpen] = useState(false);
  const visible = useMemo(() => invoices.filter((invoice) => filter === 'Toate' || invoice.status === filter), [filter]);

  return (
    <div className="space-y-5 pb-4">
      <PageHeader title="Plăți" description="Facturile tale pentru Apt. 45." />
      <section className="grid gap-3 md:grid-cols-3">
        <StatCard label="Total de plată" value={formatMdl(1240)} description="Sold curent" icon={<ReceiptText className="h-5 w-5" />} tone="warning" />
        <StatCard label="Restanțe" value={formatMdl(0)} description="Nu ai întârzieri" icon={<Clock3 className="h-5 w-5" />} tone="success" />
        <StatCard label="Achitat recent" value={formatMdl(1160)} description="Martie 2026" icon={<CheckCircle2 className="h-5 w-5" />} tone="success" />
      </section>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {(['Toate', 'Achitat', 'Neachitat', 'Întârziat'] as const).map((item) => (
          <button key={item} type="button" onClick={() => setFilter(item)} className={`h-10 shrink-0 rounded-full border px-4 text-sm font-medium ${filter === item ? 'border-foreground bg-foreground text-background' : 'border-border/70 bg-white text-foreground'}`}>
            {item}
          </button>
        ))}
      </div>
      <section className="grid gap-3">
        {visible.map((invoice) => (
          <Card key={invoice.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div><h2 className="font-semibold text-foreground">{invoice.month}</h2><p className="mt-1 text-sm text-muted-foreground">{invoice.description}</p></div>
              <Badge variant={statusVariant[invoice.status]}>{invoice.status}</Badge>
            </div>
            <div className="mt-4 flex items-end justify-between gap-3">
              <div><p className="text-xs text-muted-foreground">{invoice.number}</p><p className="mt-1 text-xl font-semibold text-foreground">{formatMdl(invoice.amount)}</p></div>
              <p className="text-xs text-muted-foreground">Scadență: {invoice.dueDate}</p>
            </div>
            {invoice.status !== 'Achitat' ? <Button className="mt-4 w-full" onClick={() => setModalOpen(true)}><CreditCard className="h-4 w-4" /> Achită</Button> : null}
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
