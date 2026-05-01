'use client';

import { useEffect, useState } from 'react';
import PlatformLayout from '@/components/PlatformLayout';
import { useRouter } from 'next/navigation';
import { salesApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

const salesNav = [
  { name: 'Sales Dashboard', href: '/sales', icon: '📊' },
];

type OrgRow = {
  id: string;
  name: string;
  isActive: boolean;
  plan: string | null;
  status: string | null;
  propertyCount: number;
  userCount: number;
  createdAt: string;
};

type CommissionData = {
  commissionRate: number;
  totalClients: number;
  totalMonthlyRevenue: number;
  totalCommission: number;
  byOrganization?: Array<{
    organizationId: string;
    organizationName: string;
    plan: string;
    monthlyPrice: number;
    commission: number;
  }>;
};

export default function SalesPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [commission, setCommission] = useState<CommissionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    organizationName: '',
    ownerEmail: '',
    ownerFirstName: '',
    ownerLastName: '',
    ownerPassword: '',
  });
  const [createError, setCreateError] = useState('');

  useEffect(() => {
    if (!isAuthenticated || (user?.role !== 'SALES' && user?.role !== 'SUPERADMIN')) {
      router.replace('/login');
      return;
    }
    Promise.all([salesApi.getMyOrganizations(), salesApi.getCommission()])
      .then(([orgsRes, commRes]) => {
        setOrgs(orgsRes.data ?? []);
        setCommission(commRes.data ?? null);
      })
      .catch(() => router.replace('/login'))
      .finally(() => setLoading(false));
  }, [router, isAuthenticated, user?.role]);

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    setCreating(true);
    try {
      await salesApi.createOrganization(createForm);
      setCreateForm({
        organizationName: '',
        ownerEmail: '',
        ownerFirstName: '',
        ownerLastName: '',
        ownerPassword: '',
      });
      setCreateOpen(false);
      const [orgsRes, commRes] = await Promise.all([
        salesApi.getMyOrganizations(),
        salesApi.getCommission(),
      ]);
      setOrgs(orgsRes.data ?? []);
      setCommission(commRes.data ?? null);
    } catch (err: any) {
      setCreateError(err.response?.data?.message || 'Failed to create organization');
    } finally {
      setCreating(false);
    }
  };

  if (loading || !commission) {
    return (
      <PlatformLayout title="Sales Dashboard" navItems={salesNav}>
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="h-8 w-48 bg-gray-100 rounded-lg animate-pulse" />
        </div>
      </PlatformLayout>
    );
  }

  return (
    <PlatformLayout title="Sales Dashboard" navItems={salesNav}>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-gray-800">Sales Dashboard</h1>
          <p className="text-sm text-gray-600 mt-1">Your clients and commission</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
            <p className="text-sm text-gray-500">My clients</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">{commission.totalClients}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
            <p className="text-sm text-gray-500">Total monthly revenue</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">
              {Number(commission.totalMonthlyRevenue).toFixed(0)}€
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
            <p className="text-sm text-gray-500">Total commission earned</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">
              {Number(commission.totalCommission).toFixed(2)}€
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              Rate: {(commission.commissionRate * 100).toFixed(0)}%
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="px-4 py-2 text-sm font-medium text-white bg-black rounded-lg hover:opacity-90"
          >
            + Create organization
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">My clients</h2>
            <p className="text-sm text-gray-500 mt-0.5">Organizations you created</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <th className="px-6 py-4">Organization</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Plan</th>
                  <th className="px-6 py-4">Properties</th>
                  <th className="px-6 py-4">Subscription</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {orgs.map((org) => (
                  <tr key={org.id} className="hover:bg-gray-50/50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{org.name}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(org.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          org.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {org.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 capitalize">
                      {org.plan ?? '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{org.propertyCount}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 capitalize">
                      {org.status ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900">Create organization</h3>
            <p className="text-sm text-gray-500 mt-1">New client and owner account</p>
            {createError && (
              <div className="mt-3 p-3 bg-red-50 text-red-700 text-sm rounded-lg">
                {createError}
              </div>
            )}
            <form onSubmit={handleCreateOrg} className="mt-4 space-y-3">
              <input
                type="text"
                placeholder="Organization name"
                required
                value={createForm.organizationName}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, organizationName: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
              <input
                type="text"
                placeholder="Owner first name"
                required
                value={createForm.ownerFirstName}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, ownerFirstName: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
              <input
                type="text"
                placeholder="Owner last name"
                required
                value={createForm.ownerLastName}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, ownerLastName: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
              <input
                type="email"
                placeholder="Owner email"
                required
                value={createForm.ownerEmail}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, ownerEmail: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
              <input
                type="password"
                placeholder="Owner password (min 6)"
                required
                minLength={6}
                value={createForm.ownerPassword}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, ownerPassword: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="flex-1 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 py-2 text-sm font-medium text-white bg-black rounded-lg hover:opacity-90 disabled:opacity-50"
                >
                  {creating ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PlatformLayout>
  );
}
