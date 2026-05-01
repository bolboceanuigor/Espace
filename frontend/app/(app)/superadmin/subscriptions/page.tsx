'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { billingSaasApi } from '@/lib/api';
import MobilePageHeader from '@/components/common/MobilePageHeader';
import EmptyState from '@/components/common/EmptyState';
import LoadingState from '@/components/common/LoadingState';
import StatusBadge from '@/components/ui/StatusBadge';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/ToastProvider';

const STATUSES = ['TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED'] as const;

export default function SuperadminSubscriptionsPage() {
  const { showToast } = useToast();
  const [status, setStatus] = useState<string>('');
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await billingSaasApi.listSuperadminSubscriptions(status as any);
      setRows(res.data || []);
    } finally {
      setLoading(false);
    }
  };

  const applyQuickAction = async (
    subscriptionId: string,
    action: 'START_TRIAL' | 'EXTEND_TRIAL_30' | 'MARK_ACTIVE' | 'MARK_PAST_DUE' | 'SUSPEND' | 'CANCEL',
  ) => {
    try {
      await billingSaasApi.quickAction(subscriptionId, action);
      await load();
      showToast('Salvat cu succes');
    } catch {
      showToast('Eroare la salvare', 'error');
    }
  };

  const markPaid = async (invoiceId: string) => {
    try {
      await billingSaasApi.markInvoicePaid(invoiceId);
      await load();
      showToast('Salvat cu succes');
    } catch {
      showToast('Eroare la salvare', 'error');
    }
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, [status]);

  return (
    <div className="space-y-4">
      <MobilePageHeader title="SaaS Subscriptions" subtitle="Manage billing lifecycle, trial and payment statuses consistently." />
      <div className="flex items-center gap-2">
        <select className="select max-w-xs" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      {loading ? <LoadingState label="Loading subscriptions..." rows={5} /> : null}
      <div className="rounded-xl border border-border/70 bg-card p-4">
        <div className="grid grid-cols-10 gap-2 border-b border-border/60 pb-2 text-xs text-muted-foreground">
          <span>Organization</span><span>Apartments</span><span>Total m2</span><span>Billing type</span><span>Price</span><span>Currency</span><span>Status</span><span>Trial end</span><span>Monthly amount</span><span>Actions</span>
        </div>
        <div className="space-y-2 pt-2">
          {(rows || []).map((row) => (
            <div key={row.id} className="grid grid-cols-10 gap-2 rounded-lg border border-border/60 px-2 py-2 text-sm text-foreground">
              <span>{row.organizationName}</span>
              <span>{row.apartments}</span>
              <span>{row.totalM2}</span>
              <span>{row.billingType}</span>
              <span>{row.price}</span>
              <span>{row.currency}</span>
              <span><StatusBadge status={row.status} /></span>
              <span>{row.trialEndDate ? new Date(row.trialEndDate).toLocaleDateString() : '-'}</span>
              <span>{row.monthlyAmount}</span>
              <span>
                <Link className="text-primary" href={`/superadmin/organizations/${row.organizationId}/subscription`}>
                  Manage
                </Link>
                <div className="mt-1 flex flex-wrap gap-1">
                  <Button size="sm" variant="outline" onClick={() => applyQuickAction(row.id, 'START_TRIAL')}>Start trial</Button>
                  <Button size="sm" variant="outline" onClick={() => applyQuickAction(row.id, 'EXTEND_TRIAL_30')}>Extend +30d</Button>
                  <Button size="sm" variant="secondary" onClick={() => applyQuickAction(row.id, 'MARK_ACTIVE')}>Active</Button>
                  <Button size="sm" variant="secondary" onClick={() => applyQuickAction(row.id, 'MARK_PAST_DUE')}>Past due</Button>
                  <Button size="sm" variant="danger" onClick={() => applyQuickAction(row.id, 'SUSPEND')}>Suspend</Button>
                  <Button size="sm" variant="danger" onClick={() => applyQuickAction(row.id, 'CANCEL')}>Cancel</Button>
                  {row.latestUnpaidInvoiceId ? (
                    <Button size="sm" variant="secondary" onClick={() => markPaid(row.latestUnpaidInvoiceId)}>
                      Mark invoice paid
                    </Button>
                  ) : null}
                </div>
              </span>
            </div>
          ))}
          {!loading && !rows.length ? <EmptyState title="Nu există date încă" description="Nu există abonamente pentru filtrul selectat." /> : null}
        </div>
      </div>
    </div>
  );
}
