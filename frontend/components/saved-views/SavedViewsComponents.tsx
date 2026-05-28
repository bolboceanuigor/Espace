'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bookmark, Columns3, Filter, Save, Star } from 'lucide-react';
import { Badge, Button, Card, Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/ui';
import { savedViewsApi } from '@/lib/api';
import { useLocalizedPath } from '@/lib/use-localized-path';

type SavedViewsBarProps = {
  module: string;
  currentFilters: Record<string, any>;
  sort?: Record<string, any>;
  onApply: (filters: Record<string, any>, sort?: Record<string, any>) => void;
};

export function SavedViewsBar({ module, currentFilters, sort, onApply }: SavedViewsBarProps) {
  const localizedPath = useLocalizedPath();
  const [views, setViews] = useState<any[]>([]);
  const [smartLists, setSmartLists] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [scope, setScope] = useState<'PERSONAL' | 'TEAM'>('PERSONAL');
  const [favorite, setFavorite] = useState(true);
  const [defaultView, setDefaultView] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [viewsRes, smartRes] = await Promise.all([
        savedViewsApi.list({ module, favoritesOnly: true, includeSystem: true }),
        savedViewsApi.smartLists({ module }),
      ]);
      setViews(viewsRes.data?.items || []);
      setSmartLists(smartRes.data?.items || []);
    } catch {
      setViews([]);
      setSmartLists([]);
    }
  }, [module]);

  useEffect(() => { void load(); }, [load]);

  async function saveView() {
    setBusy(true);
    setError('');
    try {
      await savedViewsApi.create({
        module,
        scope,
        name,
        description,
        filters: currentFilters,
        sort: sort || {},
        isFavorite: favorite,
        isDefault: defaultView,
      });
      setModalOpen(false);
      setName('');
      setDescription('');
      await load();
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut salva view-ul.'));
    } finally {
      setBusy(false);
    }
  }

  async function applyView(view: any) {
    onApply(view.filters || {}, view.sort || undefined);
    await savedViewsApi.use(view.id).catch(() => undefined);
  }

  function applySmartList(item: any) {
    onApply(item.filters || {}, undefined);
  }

  const favorites = views.slice(0, 4);
  const smart = smartLists.slice(0, 4);

  return (
    <Card className="p-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700"><Filter className="h-3.5 w-3.5" />View-uri</span>
          <button type="button" onClick={() => onApply({}, undefined)} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50">Toate</button>
          {favorites.map((view) => (
            <button key={view.id} type="button" onClick={() => applyView(view)} className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900">
              {view.isFavorite ? <Star className="h-3 w-3 fill-emerald-600 text-emerald-600" /> : null}
              {view.name}
            </button>
          ))}
          {smart.map((item) => (
            <button key={item.key} type="button" onClick={() => applySmartList(item)} className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900">
              {item.name}
              <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px]">{item.count ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={() => setModalOpen(true)}><Save className="h-4 w-4" />Salvează view</Button>
          <Link href={localizedPath('/admin/saved-views')} className="inline-flex min-h-9 items-center rounded-2xl border border-slate-200 px-3 text-xs font-semibold">Manage views</Link>
          <Link href={localizedPath('/admin/smart-lists')} className="inline-flex min-h-9 items-center rounded-2xl border border-slate-200 px-3 text-xs font-semibold">Smart lists</Link>
        </div>
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)}>
        <ModalHeader title="Salvează view" onClose={() => setModalOpen(false)} />
        <ModalBody>
          {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
          <label className="grid gap-1 text-sm font-semibold">Nume<input className="input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex: Facturi restante" /></label>
          <label className="grid gap-1 text-sm font-semibold">Descriere<textarea className="input min-h-24 py-3" value={description} onChange={(event) => setDescription(event.target.value)} /></label>
          <label className="grid gap-1 text-sm font-semibold">Scope<select className="select" value={scope} onChange={(event) => setScope(event.target.value as any)}><option value="PERSONAL">Personal</option><option value="TEAM">Team</option></select></label>
          <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={favorite} onChange={(event) => setFavorite(event.target.checked)} /> Favorit</label>
          <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={defaultView} onChange={(event) => setDefaultView(event.target.checked)} /> Setează ca default</label>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Renunță</Button>
          <Button onClick={saveView} isLoading={busy} disabled={!name.trim()}>Salvează</Button>
        </ModalFooter>
      </Modal>
    </Card>
  );
}

export function FilterSummaryChips({ filters }: { filters: Record<string, any> }) {
  const entries = Object.entries(filters || {}).filter(([, value]) => value !== undefined && value !== null && value !== '' && value !== 'ALL');
  if (!entries.length) return null;
  return <div className="flex flex-wrap gap-2">{entries.map(([key, value]) => <Badge key={key} variant="neutral">{key}: {String(value)}</Badge>)}</div>;
}

export function SmartListCard({ item, onApply, onDuplicate }: { item: any; onApply?: () => void; onDuplicate?: () => void }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Badge variant={item.severity === 'CRITICAL' ? 'error' : item.severity === 'WARNING' ? 'warning' : 'neutral'}>{item.module}</Badge>
          <h3 className="mt-3 text-lg font-bold text-slate-950">{item.name}</h3>
          <p className="mt-1 text-sm text-slate-500">{item.description}</p>
        </div>
        <div className="rounded-2xl bg-slate-100 px-3 py-2 text-xl font-bold text-slate-950">{item.count ?? '—'}</div>
      </div>
      <p className="mt-3 text-xs font-semibold text-slate-500">{item.actionHint}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {onApply ? <Button size="sm" onClick={onApply}>Deschide</Button> : null}
        {onDuplicate ? <Button size="sm" variant="secondary" onClick={onDuplicate}><Bookmark className="h-4 w-4" />Salvează ca view</Button> : null}
      </div>
    </Card>
  );
}

export function ModulePreferencesDrawer() {
  return null;
}

export function ColumnsPicker() {
  return <span className="inline-flex items-center gap-1 text-xs text-slate-500"><Columns3 className="h-3.5 w-3.5" />Coloane salvate în view, UI avansat ulterior.</span>;
}
