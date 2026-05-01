'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { clientsApi } from '@/lib/api';
import { Button, Modal, ModalBody, ModalFooter, ModalHeader, PageHeader, useToast } from '@/components/ui';

type Client = {
  id: string;
  firstName: string;
  lastName?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
};

const EMPTY_FORM = {
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  notes: '',
};

export default function ClientsPage() {
  const tPages = useTranslations('pages.clients');
  const tActions = useTranslations('actions');
  const tForm = useTranslations('form');
  const c = useTranslations('common');
  const { showToast } = useToast();

  const [items, setItems] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [page, setPage] = useState(1);
  const [showArchived, setShowArchived] = useState(false);
  const [meta, setMeta] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });

  const load = async () => {
    setLoading(true);
    try {
      const withPaging = await clientsApi.getAll(page, 20, showArchived);
      setItems(withPaging.data?.items ?? []);
      setMeta(withPaging.data?.meta ?? { page: 1, pageSize: 20, total: 0, totalPages: 1 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [page, showArchived]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...items]
      .filter((item) => {
        const fullName = `${item.firstName || ''} ${item.lastName || ''}`.trim().toLowerCase();
        return !query || fullName.includes(query) || (item.phone || '').toLowerCase().includes(query) || (item.email || '').toLowerCase().includes(query);
      })
      .sort((a, b) => `${a.firstName} ${a.lastName || ''}`.localeCompare(`${b.firstName} ${b.lastName || ''}`));
  }, [items, search]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError('');
    setIsOpen(true);
  };

  const openEdit = (item: Client) => {
    setEditing(item);
    setForm({
      firstName: item.firstName || '',
      lastName: item.lastName || '',
      phone: item.phone || '',
      email: item.email || '',
      notes: item.notes || '',
    });
    setError('');
    setIsOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim() || undefined,
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        notes: form.notes.trim() || undefined,
      };
      if (editing) {
        await clientsApi.update(editing.id, payload);
      } else {
        await clientsApi.create(payload);
      }
      setIsOpen(false);
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save client');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(c('deleteConfirm'))) return;
    try {
      await clientsApi.delete(id);
      await load();
      showToast(c('saved'), 'success');
    } catch {
      showToast(c('error'), 'error');
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={tPages('title')}
        description={tPages('desc')}
        rightSlot={
          <Button size="sm" onClick={openCreate}>
            {tActions('add')}
          </Button>
        }
      />
      <div className="rounded-3xl border border-border/60 bg-card/90 p-5 shadow-[0_18px_48px_-28px_rgba(109,40,217,0.45)]">
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={`${tActions('search')}...`}
          className="h-9 w-full max-w-sm rounded-2xl border border-border/60 bg-background px-3 text-sm text-foreground"
        />
        <label className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(event) => {
              setPage(1);
              setShowArchived(event.target.checked);
            }}
          />
          Show archived
        </label>
        <div className="mt-4 space-y-2">
          {loading ? (
            <div className="space-y-2">
              {[...Array.from({ length: 5 })].map((_, index) => (
                <div key={index} className="h-12 animate-pulse rounded-xl bg-muted/40" />
              ))}
            </div>
          ) : null}
          {!loading && filtered.length === 0 ? <p className="text-sm text-muted-foreground">No clients.</p> : null}
          {filtered.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-2xl border border-border/60 px-3 py-2">
              <div>
                <p className="text-sm font-medium text-foreground">{[item.firstName, item.lastName].filter(Boolean).join(' ')}</p>
                <p className="text-xs text-muted-foreground">{item.phone || '-'} {item.email ? `• ${item.email}` : ''}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" onClick={() => openEdit(item)}>
                  {tActions('edit')}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => handleDelete(item.id)}>
                  {tActions('delete')}
                </Button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page <= 1}
          >
            Prev
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {meta.page} / {meta.totalPages}
          </span>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setPage((current) => Math.min(meta.totalPages, current + 1))}
            disabled={page >= meta.totalPages}
          >
            Next
          </Button>
        </div>
      </div>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} maxWidth="lg">
        <ModalHeader title={editing ? tActions('edit') : tActions('add')} onClose={() => setIsOpen(false)} />
        <ModalBody className="space-y-3">
          {error ? <div className="rounded-xl border border-border/60 bg-muted/60 px-3 py-2 text-xs text-foreground">{error}</div> : null}
          <div className="grid grid-cols-2 gap-2">
            <input autoFocus className="input" placeholder={tForm('name')} value={form.firstName} onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))} />
            <input className="input" placeholder="Last name" value={form.lastName} onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))} />
          </div>
          <input className="input" placeholder={tForm('phone')} value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
          <input className="input" placeholder={tForm('email')} value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
          <textarea className="input" rows={3} placeholder={tForm('notes')} value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setIsOpen(false)}>
            {tActions('cancel')}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? '...' : tActions('save')}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
