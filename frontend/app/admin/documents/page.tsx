'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, FileText, Pencil, Plus, Search } from 'lucide-react';
import { Badge, Button, Card, PageHeader } from '@/components/ui';
import { documentsApi, filesApi } from '@/lib/api';

type Category = 'STATUT' | 'PROCES_VERBAL' | 'HOTARARE' | 'CONTRACT' | 'FINANCIAR' | 'TEHNIC' | 'ANUNT' | 'ALTUL';
type Visibility = 'ADMIN_ONLY' | 'RESIDENT_VISIBLE';

const categories: Array<{ value: Category | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'Toate categoriile' },
  { value: 'STATUT', label: 'Statut A.P.C.' },
  { value: 'PROCES_VERBAL', label: 'Proces-verbal' },
  { value: 'HOTARARE', label: 'Hotărâre' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'FINANCIAR', label: 'Financiar' },
  { value: 'TEHNIC', label: 'Tehnic' },
  { value: 'ANUNT', label: 'Anunț' },
  { value: 'ALTUL', label: 'Altul' },
];

const visibilityLabels: Record<Visibility, string> = {
  ADMIN_ONLY: 'Doar administrator',
  RESIDENT_VISIBLE: 'Vizibil pentru locatari',
};

const emptyForm = {
  title: '',
  description: '',
  category: 'PROCES_VERBAL' as Category,
  visibility: 'ADMIN_ONLY' as Visibility,
  fileUrl: '',
  fileName: '',
  mimeType: 'application/pdf',
};

function categoryLabel(value?: string) {
  return categories.find((item) => item.value === value)?.label || 'Altul';
}

function fileNameFromUrl(value: string) {
  const clean = value.split('?')[0]?.split('#')[0] || '';
  return decodeURIComponent(clean.split('/').filter(Boolean).pop() || 'document');
}

export default function AdminDocumentsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [category, setCategory] = useState<Category | 'ALL'>('ALL');
  const [visibility, setVisibility] = useState<Visibility | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(emptyForm);

  const filteredRows = useMemo(() => rows, [rows]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await documentsApi.adminList({
        category: category === 'ALL' ? undefined : category,
        visibility: visibility === 'ALL' ? undefined : visibility,
        search: search || undefined,
      });
      setRows(res.data || []);
    } catch {
      setError('Nu am putut încărca documentele.');
    } finally {
      setLoading(false);
    }
  }, [category, search, visibility]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const save = async () => {
    setMessage('');
    setError('');
    try {
      const payload = {
        ...form,
        fileName: form.fileName || fileNameFromUrl(form.fileUrl),
      };
      if (editingId) {
        await documentsApi.adminUpdate(editingId, payload);
      } else {
        await documentsApi.adminCreate(payload);
      }
      setMessage('Documentul a fost salvat.');
      setForm(emptyForm);
      setEditingId(null);
      setShowForm(false);
      await load();
    } catch {
      setError('Nu am putut salva documentul.');
    }
  };

  const edit = (row: any) => {
    setEditingId(row.id);
    setForm({
      title: row.title || '',
      description: row.description || '',
      category: (row.category || 'ALTUL') as Category,
      visibility: (row.visibility || 'ADMIN_ONLY') as Visibility,
      fileUrl: row.fileUrl || '',
      fileName: row.fileName || '',
      mimeType: row.mimeType || row.fileType || 'application/pdf',
    });
    setShowForm(true);
  };

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        title="Registru documente A.P.C."
        description="Organizează statutul, procesele-verbale, hotărârile, contractele și actele publice ale asociației."
        rightSlot={
          <Button onClick={() => { setShowForm(true); setEditingId(null); setForm(emptyForm); }}>
            <Plus className="h-4 w-4" /> Adaugă document
          </Button>
        }
      />

      {message ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</p> : null}
      {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p> : null}

      {showForm ? (
        <Card>
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">{editingId ? 'Editează document' : 'Adaugă document'}</h2>
              <p className="mt-1 text-sm text-muted-foreground">MVP folosește link manual către fișier. Încărcarea directă va fi conectată ulterior.</p>
            </div>
            <button className="text-sm font-semibold text-muted-foreground" onClick={() => setShowForm(false)}>Închide</button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs font-semibold text-muted-foreground">Titlu</span>
              <input className="input" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-muted-foreground">Categorie</span>
              <select className="select" value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value as Category }))}>
                {categories.filter((item) => item.value !== 'ALL').map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-muted-foreground">Vizibilitate</span>
              <select className="select" value={form.visibility} onChange={(event) => setForm((current) => ({ ...current, visibility: event.target.value as Visibility }))}>
                <option value="ADMIN_ONLY">Doar administrator</option>
                <option value="RESIDENT_VISIBLE">Vizibil pentru locatari</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-muted-foreground">Tip fișier</span>
              <input className="input" value={form.mimeType} onChange={(event) => setForm((current) => ({ ...current, mimeType: event.target.value }))} placeholder="application/pdf" />
            </label>
            <label className="space-y-1 md:col-span-2">
              <span className="text-xs font-semibold text-muted-foreground">Link fișier</span>
              <input className="input" value={form.fileUrl} onChange={(event) => setForm((current) => ({ ...current, fileUrl: event.target.value, fileName: current.fileName || fileNameFromUrl(event.target.value) }))} placeholder="https://..." />
            </label>
            <label className="space-y-1 md:col-span-2">
              <span className="text-xs font-semibold text-muted-foreground">Nume fișier</span>
              <input className="input" value={form.fileName} onChange={(event) => setForm((current) => ({ ...current, fileName: event.target.value }))} />
            </label>
            <label className="space-y-1 md:col-span-2">
              <span className="text-xs font-semibold text-muted-foreground">Descriere</span>
              <textarea className="input min-h-[92px]" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowForm(false)}>Anulează</Button>
            <Button onClick={save}>{editingId ? 'Salvează modificările' : 'Salvează documentul'}</Button>
          </div>
        </Card>
      ) : null}

      <Card>
        <div className="grid gap-3 md:grid-cols-[1fr_220px_220px_auto]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input className="input pl-9" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') load(); }} placeholder="Caută documente" />
          </label>
          <select className="select" value={category} onChange={(event) => setCategory(event.target.value as Category | 'ALL')}>
            {categories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <select className="select" value={visibility} onChange={(event) => setVisibility(event.target.value as Visibility | 'ALL')}>
            <option value="ALL">Toate vizibilitățile</option>
            <option value="ADMIN_ONLY">Doar administrator</option>
            <option value="RESIDENT_VISIBLE">Vizibil pentru locatari</option>
          </select>
          <Button variant="secondary" onClick={load}>Filtrează</Button>
        </div>
      </Card>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {loading ? (
          <Card className="md:col-span-2 xl:col-span-3">
            <p className="text-sm text-muted-foreground">Se încarcă datele...</p>
          </Card>
        ) : null}
        {!loading && !filteredRows.length ? (
          <Card className="md:col-span-2 xl:col-span-3">
            <p className="text-sm font-medium text-foreground">Nu există documente încă.</p>
            <p className="mt-1 text-sm text-muted-foreground">Adaugă primul document din registrul A.P.C.</p>
          </Card>
        ) : null}
        {filteredRows.map((row) => (
          <Card key={row.id} className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-foreground">{row.title}</p>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{row.description || 'Fără descriere'}</p>
              </div>
              <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="neutral">{categoryLabel(row.category)}</Badge>
              <Badge variant={row.visibility === 'RESIDENT_VISIBLE' ? 'success' : 'warning'}>{visibilityLabels[row.visibility as Visibility] || 'Doar administrator'}</Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              <p>{row.fileName}</p>
              <p>{row.createdAt ? new Date(row.createdAt).toLocaleDateString('ro-RO') : '-'}</p>
            </div>
            <div className="mt-auto flex flex-wrap gap-2">
              <a className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-border/70 px-3 text-sm font-semibold text-foreground hover:bg-muted/50" href={row.fileAssetId ? filesApi.secureDownloadUrl(row.fileAssetId) : row.fileUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" /> Deschide
              </a>
              <button className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-border/70 px-3 text-sm font-semibold text-foreground hover:bg-muted/50" onClick={() => edit(row)}>
                <Pencil className="h-4 w-4" /> Editează
              </button>
            </div>
          </Card>
        ))}
      </section>
    </div>
  );
}
