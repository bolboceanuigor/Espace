'use client';

import { useEffect, useState } from 'react';
import PlatformLayout from '@/components/PlatformLayout';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { adminApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

const adminNav = [
  { name: 'Dashboard', href: '/admin', icon: '📊' },
];

type OrgDetail = {
  id: string;
  name: string;
  isActive: boolean;
  onboardingCompleted: boolean;
  createdAt: string;
  subscription: {
    id: string;
    plan: string;
    status: string;
    price: number;
    customPrice: number | null;
    discountPercent: number | null;
    propertyLimit: number;
    trialEndsAt: string;
    subscriptionEndsAt: string | null;
  } | null;
  createdByAgent: { id: string; firstName: string; lastName: string; email: string } | null;
  users: { id: string; firstName: string; lastName: string; email: string; role: string; isActive: boolean; createdAt: string }[];
  _count: { properties: number; reservations: number };
  invoices: { id: string; plan: string; amount: number; discount: number; finalAmount: number; status: string; issuedAt: string; paidAt: string | null; dueDate: string }[];
  auditLogs: { id: string; action: string; entityType: string | null; payload: unknown; performedByRole: string | null; createdAt: string }[];
  monthlyRevenue: number;
  effectiveMonthlyPrice: number | null;
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    trial: 'bg-amber-100 text-amber-800',
    active: 'bg-emerald-100 text-emerald-800',
    expired: 'bg-red-100 text-red-800',
    suspended: 'bg-gray-200 text-gray-700',
    pending: 'bg-amber-100 text-amber-800',
    paid: 'bg-emerald-100 text-emerald-800',
    failed: 'bg-red-100 text-red-800',
  };
  const c = map[status] ?? 'bg-gray-100 text-gray-700';
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${c}`}>
      {status}
    </span>
  );
}

export default function AdminOrganizationPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const { user, isAuthenticated } = useAuth();
  const [org, setOrg] = useState<OrgDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [actionModal, setActionModal] = useState<'plan' | 'price' | 'discount' | 'trial' | 'limit' | null>(null);
  const [customPrice, setCustomPrice] = useState('');
  const [discountPercent, setDiscountPercent] = useState('');
  const [extendDays, setExtendDays] = useState('14');
  const [propertyLimit, setPropertyLimit] = useState('');
  const [plan, setPlan] = useState('starter');

  const load = () => {
    if (!id) return;
    adminApi.getOrganizationDetail(id)
      .then((res) => setOrg(res.data))
      .catch(() => router.replace('/admin'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'SUPERADMIN') {
      router.replace('/login');
      return;
    }
    load();
  }, [router, isAuthenticated, user?.role, id]);

  const handleStatusToggle = async () => {
    if (!org) return;
    setUpdating(true);
    try {
      await adminApi.updateOrganizationStatus(org.id, !org.isActive);
      load();
    } finally {
      setUpdating(false);
    }
  };

  const handlePlanSave = async () => {
    if (!org) return;
    setUpdating(true);
    try {
      await adminApi.updateOrganizationPlan(org.id, plan);
      setActionModal(null);
      load();
    } finally {
      setUpdating(false);
    }
  };

  const handleCustomPriceSave = async () => {
    if (!org || customPrice === '') return;
    const num = parseFloat(customPrice);
    if (Number.isNaN(num) || num < 0) return;
    setUpdating(true);
    try {
      await adminApi.setCustomPrice(org.id, num);
      setActionModal(null);
      setCustomPrice('');
      load();
    } finally {
      setUpdating(false);
    }
  };

  const handleDiscountSave = async () => {
    if (!org || discountPercent === '') return;
    const num = parseFloat(discountPercent);
    if (Number.isNaN(num) || num < 0 || num > 100) return;
    setUpdating(true);
    try {
      await adminApi.setDiscount(org.id, num);
      setActionModal(null);
      setDiscountPercent('');
      load();
    } finally {
      setUpdating(false);
    }
  };

  const handleExtendTrialSave = async () => {
    if (!org) return;
    const days = parseInt(extendDays, 10) || 14;
    setUpdating(true);
    try {
      await adminApi.extendTrial(org.id, { extendDays: days });
      setActionModal(null);
      load();
    } finally {
      setUpdating(false);
    }
  };

  const handlePropertyLimitSave = async () => {
    if (!org || propertyLimit === '') return;
    const num = parseInt(propertyLimit, 10);
    if (Number.isNaN(num) || num < 0) return;
    setUpdating(true);
    try {
      await adminApi.setPropertyLimit(org.id, num);
      setActionModal(null);
      setPropertyLimit('');
      load();
    } finally {
      setUpdating(false);
    }
  };

  const handleMarkInvoicePaid = async (invoiceId: string) => {
    setUpdating(true);
    try {
      await adminApi.markInvoicePaid(invoiceId);
      load();
    } finally {
      setUpdating(false);
    }
  };

  if (loading || !org) {
    return (
      <PlatformLayout title="Organization" navItems={adminNav}>
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="h-8 w-48 bg-gray-100 rounded-lg animate-pulse" />
        </div>
      </PlatformLayout>
    );
  }

  const sub = org.subscription;

  return (
    <PlatformLayout title={org.name} navItems={adminNav}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link href="/admin" className="text-sm text-gray-600 hover:text-gray-800">← Dashboard</Link>
            <h1 className="text-xl font-semibold tracking-tight text-gray-800 mt-1">{org.name}</h1>
            <p className="text-sm text-gray-500">ID: {org.id}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${org.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-700'}`}>
              {org.isActive ? 'Active' : 'Suspended'}
            </span>
            <button
              type="button"
              disabled={updating}
              onClick={handleStatusToggle}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {org.isActive ? 'Suspend' : 'Reactivate'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
            <p className="text-xs font-medium text-gray-500 uppercase">Properties</p>
            <p className="text-xl font-semibold text-gray-800 mt-1">{org._count.properties}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
            <p className="text-xs font-medium text-gray-500 uppercase">Reservations</p>
            <p className="text-xl font-semibold text-gray-800 mt-1">{org._count.reservations}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
            <p className="text-xs font-medium text-gray-500 uppercase">Monthly revenue (PMS)</p>
            <p className="text-xl font-semibold text-gray-800 mt-1">{Number(org.monthlyRevenue).toFixed(0)}€</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
            <p className="text-xs font-medium text-gray-500 uppercase">Subscription MRR</p>
            <p className="text-xl font-semibold text-gray-800 mt-1">{org.effectiveMonthlyPrice != null ? `${Number(org.effectiveMonthlyPrice).toFixed(0)}€` : '—'}</p>
          </div>
        </div>

        {sub && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-4">
              <h2 className="text-lg font-semibold text-gray-900">Subscription</h2>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => { setPlan(sub.plan); setActionModal('plan'); }} className="text-sm font-medium text-gray-600 hover:text-gray-800">Change plan</button>
                <button type="button" onClick={() => { setCustomPrice(String(sub.customPrice ?? sub.price)); setActionModal('price'); }} className="text-sm font-medium text-gray-600 hover:text-gray-800">Custom price</button>
                <button type="button" onClick={() => { setDiscountPercent(String(sub.discountPercent ?? 0)); setActionModal('discount'); }} className="text-sm font-medium text-gray-600 hover:text-gray-800">Discount %</button>
                <button type="button" onClick={() => setActionModal('trial')} className="text-sm font-medium text-gray-600 hover:text-gray-800">Extend trial</button>
                <button type="button" onClick={() => { setPropertyLimit(String(sub.propertyLimit)); setActionModal('limit'); }} className="text-sm font-medium text-gray-600 hover:text-gray-800">Property limit</button>
              </div>
            </div>
            <div className="px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div><span className="text-gray-500">Plan</span><p className="font-medium capitalize">{sub.plan}</p></div>
              <div><span className="text-gray-500">Status</span><p><StatusBadge status={sub.status} /></p></div>
              <div><span className="text-gray-500">Price</span><p>{sub.customPrice != null ? `${sub.customPrice}€ (custom)` : `${sub.price}€`}</p></div>
              <div><span className="text-gray-500">Discount</span><p>{sub.discountPercent ?? 0}%</p></div>
              <div><span className="text-gray-500">Property limit</span><p>{sub.propertyLimit}</p></div>
              <div><span className="text-gray-500">Trial ends</span><p>{formatDate(sub.trialEndsAt)}</p></div>
              <div><span className="text-gray-500">Subscription ends</span><p>{sub.subscriptionEndsAt ? formatDate(sub.subscriptionEndsAt) : '—'}</p></div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Users</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">
                  <th className="px-6 py-3">Name</th>
                  <th className="px-6 py-3">Email</th>
                  <th className="px-6 py-3">Role</th>
                  <th className="px-6 py-3">Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {org.users.map((u) => (
                  <tr key={u.id}>
                    <td className="px-6 py-3 text-sm font-medium text-gray-900">{u.firstName} {u.lastName}</td>
                    <td className="px-6 py-3 text-sm text-gray-600">{u.email}</td>
                    <td className="px-6 py-3 text-sm capitalize text-gray-600">{u.role.toLowerCase()}</td>
                    <td className="px-6 py-3">{u.isActive ? <span className="text-emerald-600">Yes</span> : <span className="text-gray-400">No</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Invoices</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">
                  <th className="px-6 py-3">Plan</th>
                  <th className="px-6 py-3">Amount</th>
                  <th className="px-6 py-3">Discount</th>
                  <th className="px-6 py-3">Final</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Issued</th>
                  <th className="px-6 py-3">Due</th>
                  <th className="px-6 py-3">Paid</th>
                  <th className="px-6 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {org.invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="px-6 py-3 text-sm capitalize">{inv.plan}</td>
                    <td className="px-6 py-3 text-sm">{Number(inv.amount).toFixed(0)}€</td>
                    <td className="px-6 py-3 text-sm">{Number(inv.discount).toFixed(0)}€</td>
                    <td className="px-6 py-3 text-sm font-medium">{Number(inv.finalAmount).toFixed(0)}€</td>
                    <td className="px-6 py-3"><StatusBadge status={inv.status} /></td>
                    <td className="px-6 py-3 text-sm text-gray-600">{formatDate(inv.issuedAt)}</td>
                    <td className="px-6 py-3 text-sm text-gray-600">{formatDate(inv.dueDate)}</td>
                    <td className="px-6 py-3 text-sm text-gray-600">{inv.paidAt ? formatDate(inv.paidAt) : '—'}</td>
                    <td className="px-6 py-3">
                      {inv.status === 'pending' && (
                        <button
                          type="button"
                          disabled={updating}
                          onClick={() => handleMarkInvoicePaid(inv.id)}
                          className="text-sm font-medium text-emerald-600 hover:text-emerald-800 disabled:opacity-50"
                        >
                          Mark paid
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Audit log</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Action</th>
                  <th className="px-6 py-3">By</th>
                  <th className="px-6 py-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {org.auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-6 py-3 text-sm text-gray-600">{formatDate(log.createdAt)}</td>
                    <td className="px-6 py-3 text-sm font-medium text-gray-900">{log.action.replace(/_/g, ' ')}</td>
                    <td className="px-6 py-3 text-sm text-gray-600">{log.performedByRole ?? '—'}</td>
                    <td className="px-6 py-3 text-sm text-gray-500">{log.payload ? JSON.stringify(log.payload) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {actionModal === 'plan' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900">Change plan</h3>
            <div className="mt-4 flex flex-wrap gap-2">
              {['starter', 'pro', 'enterprise'].map((p) => (
                <button key={p} type="button" onClick={() => setPlan(p)} className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${plan === p ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>{p}</button>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setActionModal(null)} className="flex-1 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
              <button type="button" onClick={handlePlanSave} disabled={updating} className="flex-1 py-2 text-sm font-medium text-white bg-black rounded-lg hover:opacity-90 disabled:opacity-50">Save</button>
            </div>
          </div>
        </div>
      )}

      {actionModal === 'price' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900">Custom price (€/month)</h3>
            <input type="number" min="0" step="0.01" value={customPrice} onChange={(e) => setCustomPrice(e.target.value)} className="mt-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setActionModal(null)} className="flex-1 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
              <button type="button" onClick={handleCustomPriceSave} disabled={updating} className="flex-1 py-2 text-sm font-medium text-white bg-black rounded-lg hover:opacity-90 disabled:opacity-50">Save</button>
            </div>
          </div>
        </div>
      )}

      {actionModal === 'discount' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900">Discount %</h3>
            <input type="number" min="0" max="100" step="1" value={discountPercent} onChange={(e) => setDiscountPercent(e.target.value)} className="mt-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setActionModal(null)} className="flex-1 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
              <button type="button" onClick={handleDiscountSave} disabled={updating} className="flex-1 py-2 text-sm font-medium text-white bg-black rounded-lg hover:opacity-90 disabled:opacity-50">Save</button>
            </div>
          </div>
        </div>
      )}

      {actionModal === 'trial' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900">Extend trial (days)</h3>
            <input type="number" min="1" value={extendDays} onChange={(e) => setExtendDays(e.target.value)} className="mt-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setActionModal(null)} className="flex-1 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
              <button type="button" onClick={handleExtendTrialSave} disabled={updating} className="flex-1 py-2 text-sm font-medium text-white bg-black rounded-lg hover:opacity-90 disabled:opacity-50">Extend</button>
            </div>
          </div>
        </div>
      )}

      {actionModal === 'limit' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900">Property limit</h3>
            <input type="number" min="0" value={propertyLimit} onChange={(e) => setPropertyLimit(e.target.value)} className="mt-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setActionModal(null)} className="flex-1 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
              <button type="button" onClick={handlePropertyLimitSave} disabled={updating} className="flex-1 py-2 text-sm font-medium text-white bg-black rounded-lg hover:opacity-90 disabled:opacity-50">Save</button>
            </div>
          </div>
        </div>
      )}
    </PlatformLayout>
  );
}
