'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, CreditCard, ReceiptText } from 'lucide-react';
import { Badge, Button, Card, Modal, ModalBody, ModalCloseButton, ModalFooter, ModalHeader, PageHeader, StatCard } from '@/components/ui';
import { residentDemoApi } from '@/lib/api';
import { formatMdl } from '@/lib/condo-admin-fallback';
import {
  normalizeResidentInvoice,
  normalizeResidentPayment,
  residentInvoices,
  residentInvoiceStatusVariant,
  residentPayments,
  residentProfile,
  type ResidentInvoiceStatus,
  type ResidentPayment,
} from '@/lib/resident-mvp-data';

export default function ResidentPaymentsPage() {
  const [filter, setFilter] = useState<'Toate' | ResidentInvoiceStatus>('Toate');
  const [rows, setRows] = useState(residentInvoices);
  const [payments, setPayments] = useState<ResidentPayment[]>(residentPayments);
  const [source, setSource] = useState<'api' | 'mock'>('mock');
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const visible = useMemo(() => rows.filter((invoice) => filter === 'Toate' || invoice.status === filter), [filter, rows]);
  const paidThisYear = payments.length ? payments.reduce((sum, payment) => sum + payment.amount, 0) : rows.filter((invoice) => invoice.status === 'Achitat').reduce((sum, invoice) => sum + invoice.amount, 0);
  const unpaidCount = rows.filter((invoice) => invoice.status !== 'Achitat').length;
  const currentBalance = rows.filter((invoice) => invoice.status !== 'Achitat').reduce((sum, invoice) => sum + invoice.amount, 0);

  useEffect(() => {
    let active = true;
    Promise.all([
      residentDemoApi.invoices(),
      residentDemoApi.payments().catch(() => ({ data: [] })),
    ])
      .then(([invoiceRes, paymentRes]) => {
        if (!active) return;
        const apiRows = (invoiceRes.data || []).map(normalizeResidentInvoice);
        const apiPayments = (paymentRes.data || []).map(normalizeResidentPayment);
        setRows(apiRows);
        setPayments(apiPayments);
        setSource('api');
      })
      .catch(() => {
        if (!active) return;
        setRows(residentInvoices);
        setPayments(residentPayments);
        setSource('mock');
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        title="Plăți"
        description="Soldul și istoricul plăților pentru apartamentul tău."
        rightSlot={
          <span className="rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs font-semibold text-muted-foreground">
            {source === 'api' ? 'Date reale' : 'Date temporare — API indisponibil'}
          </span>
        }
      />
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Sold curent" value={formatMdl(currentBalance || residentProfile.currentBalance)} description={currentBalance > 0 ? 'Neachitat' : residentProfile.status} icon={<ReceiptText className="h-5 w-5" />} tone={currentBalance > 0 ? 'danger' : 'success'} />
        <StatCard label="Total achitat anul acesta" value={formatMdl(paidThisYear)} description="Plăți confirmate" icon={<CheckCircle2 className="h-5 w-5" />} tone="success" />
        <StatCard label="Facturi neachitate" value={unpaidCount} description="Necesită atenție" icon={<Clock3 className="h-5 w-5" />} tone="warning" />
      </section>

      <div className="flex flex-wrap gap-2">
        {(['Toate', 'Achitat', 'Neachitat', 'Întârziat'] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setFilter(item)}
            className={`h-11 shrink-0 rounded-full border px-4 text-sm font-semibold ${filter === item ? 'border-foreground bg-foreground text-background' : 'border-border/70 bg-white text-foreground'}`}
          >
            {item}
          </button>
        ))}
      </div>

      <section className="grid gap-3">
        {visible.map((invoice) => (
          <Card key={invoice.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-foreground">{invoice.month}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{invoice.number}</p>
              </div>
              <Badge variant={residentInvoiceStatusVariant[invoice.status]}>{invoice.status}</Badge>
            </div>
            <div className="mt-4 flex items-end justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Suma</p>
                <p className="mt-1 text-xl font-semibold text-foreground">{formatMdl(invoice.amount)}</p>
              </div>
              <p className="text-right text-xs text-muted-foreground">Scadență: {invoice.dueDate}</p>
            </div>
            {invoice.status !== 'Achitat' ? (
              <Button className="mt-4 w-full" onClick={() => setPaymentModalOpen(true)}><CreditCard className="h-4 w-4" /> Achită factura</Button>
            ) : (
              <p className="mt-4 rounded-2xl bg-emerald-50 p-3 text-sm font-medium text-emerald-700">Achitat pe {invoice.paidDate}</p>
            )}
          </Card>
        ))}
        {!visible.length ? <Card className="p-5 text-sm font-medium text-muted-foreground">Nu există facturi încă.</Card> : null}
      </section>

      <Card>
        <h2 className="font-semibold text-foreground">Istoric plăți</h2>
        <div className="mt-4 grid gap-2">
          {payments.map((payment) => (
            <div key={payment.id} className="flex items-center justify-between gap-3 rounded-2xl bg-muted/35 px-3 py-3 text-sm">
              <div>
                <p className="font-semibold text-foreground">{formatMdl(payment.amount)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{payment.method}</p>
              </div>
              <p className="text-right text-xs text-muted-foreground">{payment.paidAt}</p>
            </div>
          ))}
          {!payments.length ? <p className="rounded-2xl bg-muted/35 px-3 py-3 text-sm text-muted-foreground">Nu există plăți încă.</p> : null}
        </div>
      </Card>

      <Modal isOpen={paymentModalOpen} onClose={() => setPaymentModalOpen(false)} maxWidth="md">
        <ModalHeader title="Plăți online" onClose={() => setPaymentModalOpen(false)} />
        <ModalBody>
          <p className="text-sm text-muted-foreground">Integrarea plăților online va fi conectată ulterior.</p>
        </ModalBody>
        <ModalFooter>
          <ModalCloseButton onClick={() => setPaymentModalOpen(false)}>Am înțeles</ModalCloseButton>
        </ModalFooter>
      </Modal>
    </div>
  );
}
