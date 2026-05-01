'use client';

import { useEffect, useState } from 'react';
import { maintenanceApi } from '@/lib/api';

export default function AdminSuppliersPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    serviceType: '',
  });

  const load = async () => {
    const res = await maintenanceApi.suppliersList();
    setRows(res.data || []);
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-foreground">Suppliers</h1>
      <div className="grid grid-cols-1 gap-2 rounded-xl border border-border/70 bg-card p-4 md:grid-cols-5">
        <input className="input" placeholder="Name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
        <input className="input" placeholder="Contact person" value={form.contactPerson} onChange={(e) => setForm((p) => ({ ...p, contactPerson: e.target.value }))} />
        <input className="input" placeholder="Phone" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
        <input className="input" placeholder="Email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
        <div className="flex gap-2">
          <input className="input" placeholder="Service type" value={form.serviceType} onChange={(e) => setForm((p) => ({ ...p, serviceType: e.target.value }))} />
          <button
            className="rounded-md border border-border/70 px-3 py-2 text-sm"
            onClick={async () => {
              await maintenanceApi.suppliersCreate(form);
              setForm({ name: '', contactPerson: '', phone: '', email: '', serviceType: '' });
              await load();
            }}
          >
            Add
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-card p-3">
            <div>
              <p className="font-medium text-foreground">{row.name}</p>
              <p className="text-xs text-muted-foreground">
                {row.contactPerson || '-'} · {row.phone || '-'} · {row.email || '-'} · {row.serviceType || '-'}
              </p>
            </div>
            <button
              className="rounded-md border border-border/70 px-2 py-1 text-xs"
              onClick={async () => {
                await maintenanceApi.suppliersDelete(row.id);
                await load();
              }}
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

