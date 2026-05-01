'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { getToken, getUser } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { organizationsApi } from '@/lib/api';
import Toast from '@/components/Toast';
import InviteUserModal from '@/components/InviteUserModal';

export default function OrganizationSettingsPage() {
  const router = useRouter();
  const user = getUser();
  const normalizedRole = (user?.role || '').toUpperCase();
  const isAdmin = normalizedRole === 'ADMIN' || normalizedRole === 'SUPERADMIN';
  const [org, setOrg] = useState<{ id: string; name: string } | null>(null);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; visible: boolean; type: 'success' | 'error' }>({
    message: '',
    visible: false,
    type: 'success',
  });

  const fetchOrg = useCallback(async () => {
    try {
      const res = await organizationsApi.getMe();
      setOrg(res.data);
      setName(res.data.name ?? '');
    } catch (err) {
      console.error('Failed to fetch organization', err);
      setToast({ message: 'Failed to load organization.', visible: true, type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push('/login');
      return;
    }
    fetchOrg();
  }, [router, fetchOrg]);

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await organizationsApi.updateMe({ name: name.trim() });
      setToast({ message: 'Organization updated.', visible: true, type: 'success' });
      fetchOrg();
    } catch (err: any) {
      setToast({
        message: err.response?.data?.message || 'Failed to update.',
        visible: true,
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleInviteSuccess = () => {
    setInviteModalOpen(false);
    setToast({ message: 'User invited.', visible: true, type: 'success' });
  };

  const dismissToast = () => setToast((t) => ({ ...t, visible: false }));

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[300px] text-gray-600">Loading...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-gray-800">Organization Settings</h1>
          <p className="text-gray-600 mt-1">Manage your organization</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Organization name</h2>
          <form onSubmit={handleSaveName} className="flex flex-col sm:flex-row gap-4">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 px-4 py-3 border border-gray-200 rounded-lg focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
              placeholder="Organization name"
            />
            <button
              type="submit"
              disabled={saving || !isAdmin}
              className="px-5 py-3 bg-black text-white rounded-lg hover:opacity-90 font-medium disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </form>
        </div>

        {isAdmin ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Team</h2>
            <p className="text-sm text-gray-600 mb-4">Invite users to your organization.</p>
            <button
              type="button"
              onClick={() => setInviteModalOpen(true)}
              className="px-5 py-2.5 bg-black text-white rounded-lg hover:opacity-90 font-medium"
            >
              Invite User
            </button>
          </div>
        ) : null}
      </div>

      {isAdmin ? (
        <InviteUserModal
          isOpen={inviteModalOpen}
          onClose={() => setInviteModalOpen(false)}
          onSuccess={handleInviteSuccess}
        />
      ) : null}

      <Toast
        message={toast.message}
        visible={toast.visible}
        onDismiss={dismissToast}
        type={toast.type}
      />
    </DashboardLayout>
  );
}
