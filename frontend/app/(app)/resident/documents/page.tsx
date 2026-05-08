'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, FileText, Search } from 'lucide-react';
import { Badge, Card, PageHeader } from '@/components/ui';
import { documentsApi } from '@/lib/api';

type Category = 'STATUT' | 'PROCES_VERBAL' | 'HOTARARE' | 'CONTRACT' | 'FINANCIAR' | 'TEHNIC' | 'ANUNT' | 'ALTUL';

const categories: Array<{ value: Category | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'Toate documentele' },
  { value: 'STATUT', label: 'Statut A.P.C.' },
  { value: 'PROCES_VERBAL', label: 'Procese-verbale' },
  { value: 'HOTARARE', label: 'Hotărâri' },
  { value: 'ANUNT', label: 'Anunțuri / acte publice' },
  { value: 'ALTUL', label: 'Alte documente publice' },
];

function categoryLabel(value?: string) {
  return categories.find((item) => item.value === value)?.label || 'Altul';
}

export default function ResidentDocumentsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [category, setCategory] = useState<Category | 'ALL'>('ALL');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await documentsApi.residentList({
        category: category === 'ALL' ? undefined : category,
        search: search || undefined,
      });
      setRows(res.data || []);
    } catch {
      setError('Nu am putut încărca documentele.');
    } finally {
      setLoading(false);
    }
  }, [category, search]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        title="Documente A.P.C."
        description="Statut, procese-verbale, hotărâri și documente publice partajate de administrator."
      />

      {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p> : null}

      <Card>
        <div className="grid gap-3 md:grid-cols-[1fr_240px_auto]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input className="input pl-9" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') load(); }} placeholder="Caută după titlu" />
          </label>
          <select className="select" value={category} onChange={(event) => setCategory(event.target.value as Category | 'ALL')}>
            {categories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <button className="min-h-10 rounded-2xl border border-border/70 px-4 text-sm font-semibold text-foreground hover:bg-muted/50" onClick={load}>
            Filtrează
          </button>
        </div>
      </Card>

      <section className="grid gap-3 md:grid-cols-2">
        {loading ? (
          <Card className="md:col-span-2">
            <p className="text-sm text-muted-foreground">Se încarcă datele...</p>
          </Card>
        ) : null}
        {!loading && !rows.length ? (
          <Card className="md:col-span-2">
            <p className="text-sm font-semibold text-foreground">Nu există documente publice încă.</p>
            <p className="mt-1 text-sm text-muted-foreground">Administratorul va publica aici documentele vizibile locatarilor.</p>
          </Card>
        ) : null}
        {rows.map((row) => (
          <Card key={row.id} className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-foreground">{row.title}</p>
                <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{row.description || 'Fără descriere'}</p>
              </div>
              <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="neutral">{categoryLabel(row.category)}</Badge>
              <Badge variant="success">Public</Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              <p>{row.fileName}</p>
              <p>{row.createdAt ? new Date(row.createdAt).toLocaleDateString('ro-RO') : '-'}</p>
            </div>
            <a
              className="mt-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-border/70 px-4 text-sm font-semibold text-foreground hover:bg-muted/50"
              href={row.fileUrl}
              target="_blank"
              rel="noreferrer"
            >
              <Download className="h-4 w-4" /> Deschide documentul
            </a>
          </Card>
        ))}
      </section>
    </div>
  );
}
