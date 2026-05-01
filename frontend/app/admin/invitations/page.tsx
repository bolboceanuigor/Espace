'use client';

import { useEffect, useState } from 'react';
import { invitationsApi, adminStructureApi, billingSaasApi } from '@/lib/api';
import { isWriteBlockedBySubscription } from '@/lib/subscription-access';

export default function AdminInvitationsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [apartments, setApartments] = useState<any[]>([]);
  const [subscriptionStatus, setSubscriptionStatus] = useState('');
  const [form, setForm] = useState({
    email: '',
    phone: '',
    role: 'RESIDENT' as 'ADMIN' | 'RESIDENT',
    apartmentId: '',
    residentType: 'OWNER' as 'OWNER' | 'TENANT' | 'CONTACT',
  });

  const load = async () => {
    const [invitationsRes, apartmentsRes] = await Promise.all([invitationsApi.list(), adminStructureApi.listApartments()]);
    setRows(invitationsRes.data || []);
    setApartments(apartmentsRes.data || []);
  };

  useEffect(() => {
    load().catch(() => undefined);
    billingSaasApi
      .getAdminSubscription()
      .then((res) => setSubscriptionStatus(String(res.data?.status || '').toUpperCase()))
      .catch(() => setSubscriptionStatus(''));
  }, []);

  const writeBlocked = isWriteBlockedBySubscription(subscriptionStatus);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-foreground">Invitations</h1>
      <div className="rounded-xl border border-border/70 bg-card p-4">
        <p className="mb-2 text-sm font-medium text-foreground">Create invitation</p>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-6">
          <input className="input" placeholder="Email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
          <input className="input" placeholder="Phone (optional)" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
          <select className="select" value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value as 'ADMIN' | 'RESIDENT' }))}>
            <option value="RESIDENT">RESIDENT</option>
            <option value="ADMIN">ADMIN</option>
          </select>
          <select className="select" value={form.apartmentId} onChange={(e) => setForm((p) => ({ ...p, apartmentId: e.target.value }))}>
            <option value="">Apartment (optional)</option>
            {apartments.map((apartment) => (
              <option key={apartment.id} value={apartment.id}>
                {apartment.building?.name} / {apartment.staircase?.name} / #{apartment.number}
              </option>
            ))}
          </select>
          <select className="select" value={form.residentType} onChange={(e) => setForm((p) => ({ ...p, residentType: e.target.value as 'OWNER' | 'TENANT' | 'CONTACT' }))}>
            <option value="OWNER">OWNER</option>
            <option value="TENANT">TENANT</option>
            <option value="CONTACT">CONTACT</option>
          </select>
          <button
            className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            disabled={writeBlocked}
            onClick={async () => {
              if (writeBlocked) return;
              await invitationsApi.create({
                email: form.email,
                phone: form.phone || undefined,
                role: form.role,
                apartmentId: form.apartmentId || undefined,
                residentType: form.role === 'RESIDENT' ? form.residentType : undefined,
              });
              setForm({ email: '', phone: '', role: 'RESIDENT', apartmentId: '', residentType: 'OWNER' });
              await load();
            }}
          >
            Invite
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-border/70 bg-card p-4">
        <div className="grid grid-cols-8 gap-2 border-b border-border/60 pb-2 text-xs text-muted-foreground">
          <span>Email</span><span>Role</span><span>Apartment</span><span>Resident type</span><span>Status</span><span>Expires</span><span>Phone</span><span>Actions</span>
        </div>
        <div className="space-y-2 pt-2">
          {rows.map((row) => (
            <div key={row.id} className="grid grid-cols-8 gap-2 rounded-lg border border-border/60 px-2 py-2 text-sm text-foreground">
              <span>{row.email}</span>
              <span>{row.role}</span>
              <span>{row.apartment ? `${row.apartment.building?.name} / ${row.apartment.staircase?.name} / #${row.apartment.number}` : '-'}</span>
              <span>{row.residentType || '-'}</span>
              <span>{row.status}</span>
              <span>{new Date(row.expiresAt).toLocaleDateString()}</span>
              <span>{row.phone || '-'}</span>
              <span className="space-x-2">
                <button
                  className="text-primary disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={writeBlocked}
                  onClick={async () => {
                    if (writeBlocked) return;
                    await invitationsApi.resend(row.id);
                    await load();
                  }}
                >
                  Resend
                </button>
                <button
                  className="text-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={writeBlocked}
                  onClick={async () => {
                    if (writeBlocked) return;
                    await invitationsApi.cancel(row.id);
                    await load();
                  }}
                >
                  Cancel
                </button>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
