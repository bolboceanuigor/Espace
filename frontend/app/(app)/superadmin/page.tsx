'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { normalizeRole } from '@/lib/role-routing';
import Link from 'next/link';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export default function SuperadminPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    let active = true;
    api<any>('/api/superadmin/command-center')
      .then((res) => {
        if (active) {
          setData(res.data);
        }
      })
      .catch(() => {
        if (active) {
          setError('Nu am putut încărca Command Center.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (normalizeRole(user?.role) !== 'SUPER_ADMIN') return null;
  if (loading) return <div className="text-sm text-muted-foreground">Loading superadmin overview...</div>;
  if (error) {
    return (
      <div className="space-y-3 rounded-xl border border-border/70 bg-card p-4">
        <p className="text-sm text-destructive">{error}</p>
        <button className="rounded-md border border-border/70 px-3 py-2 text-sm" onClick={() => window.location.reload()}>
          Reîncearcă
        </button>
      </div>
    );
  }
  const organizationStatusChartData = [
    { name: 'Active', value: Number(data?.organizations?.active || 0) },
    { name: 'Trial', value: Number(data?.organizations?.trial || 0) },
    { name: 'Past due', value: Number(data?.organizations?.pastDue || 0) },
    { name: 'Suspended', value: Number(data?.organizations?.suspended || 0) },
    { name: 'Cancelled', value: Number(data?.organizations?.cancelled || 0) },
  ];
  const revenueChartData = [
    { name: 'MRR', value: Number(data?.revenue?.monthlyRecurringRevenueEstimate || 0) },
    { name: 'Overdue', value: Number(data?.revenue?.overdueAmount || 0) },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold text-foreground">Superadmin Command Center</h1>
        <Link href="/superadmin/tasks" className="rounded-md border border-border/70 px-3 py-2 text-xs hover:bg-muted/40">
          Open task board
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        {[
          ['MRR estimate', data?.revenue?.monthlyRecurringRevenueEstimate],
          ['Paid org invoices', data?.revenue?.paidOrganizationInvoices],
          ['Unpaid org invoices', data?.revenue?.unpaidOrganizationInvoices],
          ['Overdue amount', data?.revenue?.overdueAmount],
          ['Organizations total', data?.organizations?.total],
          ['Active organizations', data?.organizations?.active],
          ['Total apartments', data?.usage?.totalApartments],
          ['Total residents', data?.usage?.totalResidents],
          ['New leads (month)', data?.sales?.newLeads],
          ['Demo requests (month)', data?.sales?.demoRequests],
          ['Trial conversion %', data?.sales?.trialConversionRate],
          ['Pending follow-ups', data?.support?.pendingFollowUps],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-xl border border-border/70 bg-card p-4">
            <p className="text-xs uppercase text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{String(value ?? 0)}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-border/70 bg-card p-4">
          <p className="mb-2 text-sm font-medium text-foreground">Revenue snapshot</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-xl border border-border/70 bg-card p-4">
          <p className="mb-2 text-sm font-medium text-foreground">Organization statuses</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={organizationStatusChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-border/70 bg-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">Trials ending soon</p>
            <Link href="/superadmin/trials" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          <div className="space-y-2">
            {(data?.tables?.trialsEndingSoon || []).map((row: any) => (
              <div key={row.organizationId} className="rounded-md border border-border/60 px-2 py-1 text-xs">
                <p className="font-medium text-foreground">{row.organizationName}</p>
                <p className="text-muted-foreground">{row.trialEndDate ? new Date(row.trialEndDate).toLocaleDateString() : '-'}</p>
              </div>
            ))}
            {!data?.tables?.trialsEndingSoon?.length ? <p className="text-xs text-muted-foreground">No trials ending soon.</p> : null}
          </div>
        </div>
        <div className="rounded-xl border border-border/70 bg-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">Overdue organizations</p>
            <Link href="/superadmin/subscriptions" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          <div className="space-y-2">
            {(data?.tables?.overdueOrganizations || []).map((row: any) => (
              <div key={row.organizationId} className="rounded-md border border-border/60 px-2 py-1 text-xs">
                <p className="font-medium text-foreground">{row.organizationName}</p>
                <p className="text-muted-foreground">{row.status} - {Number(row.outstandingAmount || 0).toFixed(2)} {row.currency}</p>
              </div>
            ))}
            {!data?.tables?.overdueOrganizations?.length ? <p className="text-xs text-muted-foreground">No overdue organizations.</p> : null}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-border/70 bg-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">Pending follow-ups</p>
            <Link href="/superadmin/follow-ups" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          <div className="space-y-2">
            {(data?.tables?.pendingFollowUps || []).map((row: any) => (
              <div key={row.id} className="rounded-md border border-border/60 px-2 py-1 text-xs">
                <p className="font-medium text-foreground">{row.organizationName}</p>
                <p className="text-muted-foreground">{row.title}</p>
                <p className="text-muted-foreground">{row.followUpAt ? new Date(row.followUpAt).toLocaleString() : '-'}</p>
              </div>
            ))}
            {!data?.tables?.pendingFollowUps?.length ? <p className="text-xs text-muted-foreground">No pending follow-ups.</p> : null}
          </div>
        </div>
        <div className="rounded-xl border border-border/70 bg-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">Recent leads</p>
            <Link href="/superadmin/leads" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          <div className="space-y-2">
            {(data?.tables?.recentLeads || []).map((row: any) => (
              <div key={row.id} className="rounded-md border border-border/60 px-2 py-1 text-xs">
                <p className="font-medium text-foreground">{row.name}</p>
                <p className="text-muted-foreground">{row.email} - {row.status}</p>
              </div>
            ))}
            {!data?.tables?.recentLeads?.length ? <p className="text-xs text-muted-foreground">No leads yet.</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

