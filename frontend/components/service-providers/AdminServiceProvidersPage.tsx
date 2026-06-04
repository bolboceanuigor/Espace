'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Mail, Pencil, Phone, Search, Trash2, UserCheck, Wrench } from 'lucide-react';
import { useTranslations } from 'next-intl';
import EmptyState from '@/components/common/EmptyState';
import LoadingState from '@/components/common/LoadingState';
import Button from '@/components/ui/Button';
import Card, { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import StatCard from '@/components/ui/StatCard';
import { maintenanceApi } from '@/lib/api';

type ServiceProviderRow = {
  id: string;
  name: string;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  serviceType?: string | null;
};

const emptyForm = {
  name: '',
  contactPerson: '',
  phone: '',
  email: '',
  serviceType: '',
};

export default function AdminServiceProvidersPage() {
  const t = useTranslations('pages.serviceProviders');
  const [rows, setRows] = useState<ServiceProviderRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async (term = search) => {
    setLoading(true);
    setError('');
    try {
      const response = await maintenanceApi.serviceProvidersList({ search: term || undefined });
      setRows(response.data || []);
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut încărca prestatorii.'));
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    load('').catch(() => undefined);
  }, [load]);

  const stats = useMemo(() => {
    const withContact = rows.filter((row) => row.phone || row.email).length;
    const categories = new Set(rows.map((row) => (row.serviceType || '').trim()).filter(Boolean)).size;
    return { total: rows.length, withContact, categories };
  }, [rows]);

  function startEdit(row: ServiceProviderRow) {
    setEditingId(row.id);
    setForm({
      name: row.name || '',
      contactPerson: row.contactPerson || '',
      phone: row.phone || '',
      email: row.email || '',
      serviceType: row.serviceType || '',
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function submit() {
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        name: form.name.trim(),
        contactPerson: form.contactPerson.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        serviceType: form.serviceType.trim() || undefined,
      };
      if (editingId) {
        await maintenanceApi.serviceProvidersUpdate(editingId, payload);
      } else {
        await maintenanceApi.serviceProvidersCreate(payload);
      }
      resetForm();
      await load(search);
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut salva prestatorul.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(id: string) {
    setDeletingId(id);
    setError('');
    try {
      await maintenanceApi.serviceProvidersDelete(id);
      if (editingId === id) resetForm();
      await load(search);
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut șterge prestatorul.'));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label={t('statsTotal')} value={stats.total} description={t('listDescription')} icon={<UserCheck className="h-5 w-5" />} tone="success" />
        <StatCard label={t('statsReachable')} value={stats.withContact} description={t('desc')} icon={<Phone className="h-5 w-5" />} />
        <StatCard label={t('statsCategories')} value={stats.categories} description={t('listTitle')} icon={<Wrench className="h-5 w-5" />} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>{t('listTitle')}</CardTitle>
              <CardDescription>{t('listDescription')}</CardDescription>
            </div>
            <div className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void load(search);
                }}
                placeholder={t('searchPlaceholder')}
                className="h-11 w-full rounded-xl border border-border/80 bg-card py-2 pl-9 pr-3 text-sm text-foreground shadow-sm outline-none transition placeholder:text-muted-foreground/70 focus:border-primary/30 focus:ring-2 focus:ring-primary/15"
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {error ? <div className="rounded-2xl border border-critical/20 bg-critical/10 px-4 py-3 text-sm text-critical">{error}</div> : null}
            {loading ? <LoadingState label={t('desc')} rows={4} /> : null}
            {!loading && rows.length === 0 ? <EmptyState title={t('emptyTitle')} description={t('emptyDescription')} /> : null}
            {!loading && rows.length > 0 ? (
              <div className="space-y-3">
                {rows.map((row) => (
                  <div key={row.id} className="rounded-2xl border border-border/75 bg-card p-4 shadow-card">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-base font-semibold text-foreground">{row.name}</p>
                        <p className="text-sm text-muted-foreground">{row.serviceType || '—'}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="secondary" size="sm" onClick={() => startEdit(row)}>
                          <Pencil className="h-4 w-4" />
                          {t('edit')}
                        </Button>
                        <Button variant="danger" size="sm" isLoading={deletingId === row.id} onClick={() => remove(row.id)}>
                          <Trash2 className="h-4 w-4" />
                          {t('delete')}
                        </Button>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-muted-foreground md:grid-cols-3">
                      <div className="rounded-xl border border-border/70 bg-muted/20 px-3 py-2">
                        <span className="block text-xs uppercase tracking-[0.08em] text-muted-foreground/80">{t('contactPerson')}</span>
                        <span className="block text-foreground">{row.contactPerson || '—'}</span>
                      </div>
                      <div className="rounded-xl border border-border/70 bg-muted/20 px-3 py-2">
                        <span className="flex items-center gap-1 text-xs uppercase tracking-[0.08em] text-muted-foreground/80"><Phone className="h-3 w-3" /> {t('phone')}</span>
                        <span className="block text-foreground">{row.phone || '—'}</span>
                      </div>
                      <div className="rounded-xl border border-border/70 bg-muted/20 px-3 py-2">
                        <span className="flex items-center gap-1 text-xs uppercase tracking-[0.08em] text-muted-foreground/80"><Mail className="h-3 w-3" /> {t('email')}</span>
                        <span className="block text-foreground">{row.email || '—'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>{editingId ? t('editProvider') : t('newProvider')}</CardTitle>
              <CardDescription>{t('desc')}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input label={t('name')} value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} required />
            <Input label={t('contactPerson')} value={form.contactPerson} onChange={(event) => setForm((prev) => ({ ...prev, contactPerson: event.target.value }))} />
            <Input label={t('phone')} value={form.phone} onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))} />
            <Input label={t('email')} type="email" value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} />
            <Input label={t('serviceType')} value={form.serviceType} onChange={(event) => setForm((prev) => ({ ...prev, serviceType: event.target.value }))} />
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => void submit()} isLoading={submitting} disabled={!form.name.trim()}>
                {editingId ? t('update') : t('create')}
              </Button>
              <Button variant="secondary" onClick={resetForm} disabled={submitting}>
                {t('reset')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
