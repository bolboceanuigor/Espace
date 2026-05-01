'use client';

import Link from 'next/link';
import { useState } from 'react';
import { authApi } from '@/lib/api';
import MobilePageHeader from '@/components/common/MobilePageHeader';
import { useToast } from '@/components/ui/ToastProvider';

export default function ResidentChangePasswordPage() {
  const { showToast } = useToast();
  const [form, setForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [saving, setSaving] = useState(false);

  return (
    <div className="space-y-4 overflow-x-hidden pb-24 md:pb-4">
      <MobilePageHeader title="Schimbă parola" subtitle="Actualizează parola contului tău." showBackButton />
      <div className="rounded-2xl border border-border/70 bg-card p-4">
        <div className="space-y-3">
          <input
            type="password"
            className="input"
            placeholder="Parola curentă"
            value={form.oldPassword}
            onChange={(e) => setForm((p) => ({ ...p, oldPassword: e.target.value }))}
          />
          <input
            type="password"
            className="input"
            placeholder="Parola nouă"
            value={form.newPassword}
            onChange={(e) => setForm((p) => ({ ...p, newPassword: e.target.value }))}
          />
          <input
            type="password"
            className="input"
            placeholder="Confirmă parola nouă"
            value={form.confirmPassword}
            onChange={(e) => setForm((p) => ({ ...p, confirmPassword: e.target.value }))}
          />
          <button
            className="min-h-11 w-full rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            disabled={saving}
            onClick={async () => {
              if (!form.oldPassword || !form.newPassword || !form.confirmPassword) {
                showToast('Completează toate câmpurile.', 'error');
                return;
              }
              if (form.newPassword !== form.confirmPassword) {
                showToast('Parolele noi nu coincid.', 'error');
                return;
              }
              try {
                setSaving(true);
                await authApi.changePassword({ oldPassword: form.oldPassword, newPassword: form.newPassword });
                setForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
                showToast('Parola a fost actualizată.');
              } catch (error: any) {
                showToast(error?.message || 'Nu am putut schimba parola.', 'error');
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? 'Se salvează...' : 'Schimbă parola'}
          </button>
        </div>
      </div>
      <Link href="/resident/account" className="text-sm text-primary hover:underline">
        Back to Account
      </Link>
    </div>
  );
}
