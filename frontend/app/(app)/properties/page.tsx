'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/context/AuthContext';
import { exportsApi, propertiesApi } from '@/lib/api';
import { Button, Modal, ModalBody, ModalFooter, ModalHeader, PageHeader, useToast } from '@/components/ui';
import { useEffect } from 'react';

type Property = {
  id: string;
  name: string;
  code?: string | null;
  isActive?: boolean;
  status?: string | null;
  address?: string | null;
  basePrice?: number;
  cleaningFee?: number;
  rooms?: number;
  groupId?: string | null;
  color?: string | null;
};

const EMPTY_FORM = {
  name: '',
  code: '',
  address: '',
  basePrice: '0',
  cleaningFee: '0',
  rooms: '1',
  status: 'active',
  groupId: '',
  color: 'gray',
};

export default function PropertiesPage() {
  const tPages = useTranslations('pages.properties');
  const tActions = useTranslations('actions');
  const tForm = useTranslations('form');
  const c = useTranslations('common');
  const { user } = useAuth();
  const { showToast } = useToast();
  const normalizedRole = (user?.role || '').toUpperCase();
  const isAdmin = normalizedRole === 'ADMIN' || normalizedRole === 'SUPERADMIN';

  const [items, setItems] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<Property | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showArchived, setShowArchived] = useState(false);
  const [groups, setGroups] = useState<Array<{ id: string; name: string }>>([]);
  const [newGroupName, setNewGroupName] = useState('');

  const downloadCsv = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  const load = async () => {
    setLoading(true);
    try {
      const response = await propertiesApi.getAll(showArchived);
      setItems(response.data ?? []);
      const groupsRes = await propertiesApi.getGroups();
      setGroups(groupsRes.data ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [showArchived]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...items]
      .filter((item) => !query || item.name.toLowerCase().includes(query) || (item.code || '').toLowerCase().includes(query))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [items, search]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError('');
    setIsOpen(true);
  };

  const openEdit = (item: Property) => {
    setEditing(item);
    setForm({
      name: item.name || '',
      code: item.code || '',
      groupId: item.groupId || '',
      color: item.color || 'gray',
      address: item.address || '',
      basePrice: String(item.basePrice ?? 0),
      cleaningFee: String(item.cleaningFee ?? 0),
      rooms: String(item.rooms ?? 1),
      status: item.status || 'active',
    });
    setError('');
    setIsOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim() || undefined,
        groupId: form.groupId || undefined,
        color: form.color || 'gray',
        address: form.address.trim(),
        basePrice: Number(form.basePrice),
        cleaningFee: Number(form.cleaningFee),
        rooms: Number(form.rooms),
        status: form.status,
      };
      if (editing) {
        await propertiesApi.update(editing.id, { ...payload, groupId: form.groupId || null });
      } else {
        await propertiesApi.create(payload);
      }
      setIsOpen(false);
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save property');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(c('deleteConfirm'))) return;
    try {
      await propertiesApi.delete(id);
      await load();
      showToast(c('saved'), 'success');
    } catch {
      showToast(c('error'), 'error');
    }
  };

  const handleExport = async () => {
    try {
      const res = await exportsApi.exportProperties();
      downloadCsv(res.data, 'properties.csv');
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
          isAdmin ? (
            <div className="flex items-center gap-2">
              <input
                value={newGroupName}
                onChange={(event) => setNewGroupName(event.target.value)}
                placeholder="New group"
                className="h-9 rounded-2xl border border-border/60 bg-background px-3 text-sm text-foreground"
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  const name = newGroupName.trim();
                  if (!name) return;
                  try {
                    await propertiesApi.createGroup(name);
                    setNewGroupName('');
                    await load();
                    showToast(c('saved'), 'success');
                  } catch {
                    showToast(c('error'), 'error');
                  }
                }}
              >
                Add group
              </Button>
              <Button size="sm" variant="secondary" onClick={handleExport}>
                {tActions('export')}
              </Button>
              <Button size="sm" onClick={openCreate}>
                {tActions('add')}
              </Button>
            </div>
          ) : null
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
            onChange={(event) => setShowArchived(event.target.checked)}
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
          {!loading && filtered.length === 0 ? (
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
              <p className="text-sm text-foreground">
                No properties yet — add your first property to start scheduling.
              </p>
              {isAdmin ? (
                <Button size="sm" className="mt-3" onClick={openCreate}>
                  {tActions('add')}
                </Button>
              ) : null}
            </div>
          ) : null}
          {filtered.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-2xl border border-border/60 px-3 py-2">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {item.name} {item.code ? `(${item.code})` : ''}
                </p>
                <p className="text-xs text-muted-foreground">
                  {(item.isActive ?? item.status !== 'inactive') ? 'Active' : 'Inactive'}
                  {item.groupId ? ` • ${groups.find((group) => group.id === item.groupId)?.name || 'Group'}` : ''}
                </p>
              </div>
              {isAdmin ? (
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="secondary" onClick={() => openEdit(item)}>
                    {tActions('edit')}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => handleDelete(item.id)}>
                    {tActions('delete')}
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} maxWidth="lg">
        <ModalHeader title={editing ? tActions('edit') : tActions('add')} onClose={() => setIsOpen(false)} />
        <ModalBody className="space-y-3">
          {error ? <div className="rounded-xl border border-border/60 bg-muted/60 px-3 py-2 text-xs text-foreground">{error}</div> : null}
          <input autoFocus className="input" placeholder={tForm('name')} value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
          <input className="input" placeholder={tForm('code')} value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))} />
          <div className="grid grid-cols-2 gap-2">
            <select className="select" value={form.groupId} onChange={(e) => setForm((p) => ({ ...p, groupId: e.target.value }))}>
              <option value="">No group</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
            <select className="select" value={form.color} onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))}>
              <option value="gray">gray</option>
              <option value="blue">blue</option>
              <option value="teal">teal</option>
              <option value="violet">violet</option>
              <option value="rose">rose</option>
              <option value="amber">amber</option>
              <option value="emerald">emerald</option>
              <option value="slate">slate</option>
            </select>
          </div>
          <input className="input" placeholder={tForm('address')} value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
          <div className="grid grid-cols-3 gap-2">
            <input className="input" type="number" placeholder={tForm('basePrice')} value={form.basePrice} onChange={(e) => setForm((p) => ({ ...p, basePrice: e.target.value }))} />
            <input className="input" type="number" placeholder={tForm('cleaningFee')} value={form.cleaningFee} onChange={(e) => setForm((p) => ({ ...p, cleaningFee: e.target.value }))} />
            <input className="input" type="number" placeholder={tForm('rooms')} value={form.rooms} onChange={(e) => setForm((p) => ({ ...p, rooms: e.target.value }))} />
          </div>
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
