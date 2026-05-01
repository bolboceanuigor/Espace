'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { condoApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { PageHeader, useToast } from '@/components/ui';

type OwnerDashboard = Awaited<ReturnType<typeof condoApi.getOwnerDashboard>>['data'];

export default function OwnerPage() {
  const tCommon = useTranslations('common');
  const tOwner = useTranslations('owner');
  const { showToast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<OwnerDashboard | null>(null);

  useEffect(() => {
    let active = true;
    condoApi
      .getOwnerDashboard()
      .then((res) => {
        if (!active) return;
        setDashboard(res.data);
      })
      .catch(() => {
        if (!active) return;
        showToast(tCommon('error'), 'error');
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [showToast, tCommon]);

  const summaryCards = useMemo(
    () => [
      { label: tOwner('cards.monthlyFee'), value: dashboard?.totals.totalMonthlyFeeMdl ?? 0 },
      { label: tOwner('cards.debt'), value: dashboard?.totals.totalDebtMdl ?? 0 },
      { label: tOwner('cards.repairFund'), value: dashboard?.totals.totalRepairFundMdl ?? 0 },
    ],
    [dashboard?.totals.totalDebtMdl, dashboard?.totals.totalMonthlyFeeMdl, dashboard?.totals.totalRepairFundMdl, tOwner],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title={tOwner('title')}
        description={`${tOwner('subtitle')} ${dashboard?.organization?.name || user?.organizationId || ''}`}
      />

      <div className="grid gap-4 md:grid-cols-3">
        {summaryCards.map((card) => (
          <div key={card.label} className="rounded-3xl border border-border/60 bg-card/90 p-5 shadow-[0_18px_48px_-28px_rgba(109,40,217,0.45)]">
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className="mt-1 text-xl font-semibold text-foreground">{card.value.toFixed(2)} MDL</p>
          </div>
        ))}
      </div>

      <div className="rounded-3xl border border-border/60 bg-card/90 p-5 shadow-[0_18px_48px_-28px_rgba(109,40,217,0.45)]">
        <h2 className="text-sm font-semibold text-foreground">{tOwner('annualSummary')}</h2>
        {loading ? <p className="mt-2 text-sm text-muted-foreground">{tCommon('loading')}</p> : null}
        {!loading && !dashboard?.summary ? (
          <p className="mt-2 text-sm text-muted-foreground">{tOwner('noSummary')}</p>
        ) : null}
        {dashboard?.summary ? (
          <div className="mt-3 space-y-1 text-sm text-foreground">
            <p>
              {tOwner('year')}: {dashboard.summary.year}
            </p>
            <p>
              {tOwner('admin')}: {dashboard.summary.adminName}
            </p>
            <p>
              {tOwner('budget')}: {dashboard.summary.totalBudgetMdl.toFixed(2)} MDL
            </p>
            <p>
              {tOwner('expenses')}: {dashboard.summary.totalExpensesMdl.toFixed(2)} MDL
            </p>
            <p>
              {tOwner('summaryDebt')}: {dashboard.summary.debtTotalMdl.toFixed(2)} MDL
            </p>
          </div>
        ) : null}
      </div>

      <div className="rounded-3xl border border-border/60 bg-card/90 p-5 shadow-[0_18px_48px_-28px_rgba(109,40,217,0.45)]">
        <h2 className="text-sm font-semibold text-foreground">{tOwner('myUnits')}</h2>
        {!loading && (dashboard?.units.length || 0) === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{tOwner('noUnits')}</p>
        ) : null}
        <div className="mt-3 space-y-2">
          {dashboard?.units.map((unit) => (
            <div key={unit.id} className="rounded-2xl border border-border/60 px-3 py-2">
              <p className="text-sm font-medium text-foreground">
                {unit.buildingName} · {tOwner('unit')} {unit.unitNumber}
              </p>
              <p className="text-xs text-muted-foreground">
                {tOwner('monthlyFee')}: {unit.monthlyFeeMdl.toFixed(2)} MDL · {tOwner('debt')}: {unit.debtMdl.toFixed(2)} MDL
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-border/60 bg-card/90 p-5 shadow-[0_18px_48px_-28px_rgba(109,40,217,0.45)]">
        <h2 className="text-sm font-semibold text-foreground">{tOwner('announcements')}</h2>
        {!loading && (dashboard?.announcements.length || 0) === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{tOwner('noAnnouncements')}</p>
        ) : null}
        <div className="mt-3 space-y-3">
          {dashboard?.announcements.map((item) => (
            <div key={item.id} className="rounded-2xl border border-border/60 p-3">
              <p className="text-sm font-medium text-foreground">{item.title}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
