'use client';

import { useEffect, useMemo, useState } from 'react';
import { maintenanceApi } from '@/lib/api';

export default function AdminExpensesPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [filters, setFilters] = useState({ category: '', supplier: '', from: '', to: '' });
  const [form, setForm] = useState({
    supplierId: '',
    maintenanceTaskId: '',
    category: 'REPAIR',
    description: '',
    amount: '',
    currency: 'MDL',
    expenseDate: '',
    paidBy: 'BANK',
    invoiceNumber: '',
  });

  const load = async () => {
    const [expensesRes, suppliersRes, tasksRes] = await Promise.all([
      maintenanceApi.expensesList({
        category: filters.category || undefined,
        supplier: filters.supplier || undefined,
        from: filters.from || undefined,
        to: filters.to || undefined,
      }),
      maintenanceApi.suppliersList(),
      maintenanceApi.tasksList(),
    ]);
    setRows(expensesRes.data || []);
    setSuppliers(suppliersRes.data || []);
    setTasks(tasksRes.data || []);
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, [filters.category, filters.supplier, filters.from, filters.to]);

  const total = useMemo(() => rows.reduce((sum, row) => sum + Number(row.amount || 0), 0), [rows]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-foreground">Expenses</h1>
      <div className="grid grid-cols-1 gap-2 rounded-xl border border-border/70 bg-card p-4 md:grid-cols-4">
        <select className="select" value={filters.category} onChange={(e) => setFilters((p) => ({ ...p, category: e.target.value }))}>
          <option value="">All categories</option>
          {['REPAIR', 'CLEANING', 'UTILITIES', 'SALARY', 'OTHER'].map((x) => (
            <option key={x} value={x}>{x}</option>
          ))}
        </select>
        <select className="select" value={filters.supplier} onChange={(e) => setFilters((p) => ({ ...p, supplier: e.target.value }))}>
          <option value="">All suppliers</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <input className="input" type="date" value={filters.from} onChange={(e) => setFilters((p) => ({ ...p, from: e.target.value }))} />
        <input className="input" type="date" value={filters.to} onChange={(e) => setFilters((p) => ({ ...p, to: e.target.value }))} />
      </div>

      <div className="rounded-xl border border-border/70 bg-card p-4">
        <p className="text-sm text-muted-foreground">Total expenses (filtered):</p>
        <p className="text-xl font-semibold">{total.toFixed(2)} MDL</p>
      </div>

      <div className="grid grid-cols-1 gap-2 rounded-xl border border-border/70 bg-card p-4 md:grid-cols-5">
        <select className="select" value={form.supplierId} onChange={(e) => setForm((p) => ({ ...p, supplierId: e.target.value }))}>
          <option value="">Supplier</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select className="select" value={form.maintenanceTaskId} onChange={(e) => setForm((p) => ({ ...p, maintenanceTaskId: e.target.value }))}>
          <option value="">Maintenance task</option>
          {tasks.map((t) => (
            <option key={t.id} value={t.id}>{t.title}</option>
          ))}
        </select>
        <select className="select" value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}>
          {['REPAIR', 'CLEANING', 'UTILITIES', 'SALARY', 'OTHER'].map((x) => (
            <option key={x} value={x}>{x}</option>
          ))}
        </select>
        <input className="input" placeholder="Description" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
        <input className="input" placeholder="Amount" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} />
        <select className="select" value={form.currency} onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))}>
          {['MDL', 'EUR', 'USD'].map((x) => (
            <option key={x} value={x}>{x}</option>
          ))}
        </select>
        <input className="input" type="date" value={form.expenseDate} onChange={(e) => setForm((p) => ({ ...p, expenseDate: e.target.value }))} />
        <select className="select" value={form.paidBy} onChange={(e) => setForm((p) => ({ ...p, paidBy: e.target.value }))}>
          {['CASH', 'BANK', 'CARD'].map((x) => (
            <option key={x} value={x}>{x}</option>
          ))}
        </select>
        <input className="input" placeholder="Invoice number" value={form.invoiceNumber} onChange={(e) => setForm((p) => ({ ...p, invoiceNumber: e.target.value }))} />
        <button
          className="rounded-md border border-border/70 px-3 py-2 text-sm"
          onClick={async () => {
            await maintenanceApi.expensesCreate({
              ...form,
              supplierId: form.supplierId || undefined,
              maintenanceTaskId: form.maintenanceTaskId || undefined,
              amount: Number(form.amount),
              expenseDate: new Date(form.expenseDate).toISOString(),
              invoiceNumber: form.invoiceNumber || undefined,
            });
            setForm({
              supplierId: '',
              maintenanceTaskId: '',
              category: 'REPAIR',
              description: '',
              amount: '',
              currency: 'MDL',
              expenseDate: '',
              paidBy: 'BANK',
              invoiceNumber: '',
            });
            await load();
          }}
        >
          Add expense
        </button>
      </div>

      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.id} className="rounded-xl border border-border/70 bg-card p-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-foreground">{row.description}</p>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{row.category}</span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{row.paidBy}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {Number(row.amount).toFixed(2)} {row.currency} · {row.supplier?.name || '-'} · {new Date(row.expenseDate).toLocaleDateString()}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="rounded-md border border-border/70 px-2 py-1 text-xs" onClick={async () => { await maintenanceApi.expensesDelete(row.id); await load(); }}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

