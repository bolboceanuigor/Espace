'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Building2, Download, FileSpreadsheet, Layers3, UploadCloud } from 'lucide-react';
import { Card, PageHeader } from '@/components/ui';
import EmptyState from '@/components/common/EmptyState';
import LoadingState from '@/components/common/LoadingState';
import { adminImportsApi, adminStructureApi } from '@/lib/api';
import { useLocalizedPath } from '@/lib/use-localized-path';

const sampleRows = [
  ['scara', 'apartament', 'etaj', 'suprafata_m2', 'camere', 'proprietar_prenume', 'proprietar_nume', 'telefon', 'email', 'rol', 'observatii'],
  ['2', '45', '6', '72.4', '3', 'Ion', 'Popescu', '+37360000000', 'ion@example.com', 'OWNER', ''],
  ['1', '12', '3', '48.2', '2', 'Elena', 'Rusu', '+37361111111', 'elena@example.com', 'OWNER', ''],
];

const requiredColumns = ['scara', 'apartament', 'etaj', 'suprafata_m2'];
const optionalColumns = ['camere', 'proprietar_prenume', 'proprietar_nume', 'telefon', 'email', 'rol', 'observatii'];

type ImportSummary = {
  totalRows: number;
  createdApartments: number;
  skippedApartments: number;
  createdResidents: number;
  linkedResidents: number;
  createdStaircases: number;
  errors: Array<{ row: number; message?: string; messages?: string[] }>;
  message?: string;
};

export default function AdminApartmentsImportPage() {
  const localizedPath = useLocalizedPath();
  const [buildings, setBuildings] = useState<any[]>([]);
  const [buildingId, setBuildingId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string[][]>([]);
  const [loadingBuildings, setLoadingBuildings] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  useEffect(() => {
    let active = true;
    adminStructureApi
      .listBuildings()
      .then((res) => {
        if (!active) return;
        const rows = res.data || [];
        setBuildings(rows);
        setBuildingId(rows.length === 1 ? rows[0]?.id || '' : '');
      })
      .catch(() => {
        if (!active) return;
        setError('Nu am putut încărca blocurile.');
      })
      .finally(() => {
        if (active) setLoadingBuildings(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const selectedBuilding = useMemo(() => buildings.find((item) => item.id === buildingId), [buildingId, buildings]);

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] || null;
    setFile(selected);
    setSummary(null);
    setError('');
    setPreview([]);

    if (!selected) return;
    if (!/\.(csv|xlsx|xls)$/i.test(selected.name)) {
      setFile(null);
      setError('Alege un fișier CSV sau XLSX.');
      return;
    }
    if (selected.name.toLowerCase().endsWith('.csv')) {
      selected.text().then((text) => {
        const rows = text
          .split(/\r?\n/)
          .filter(Boolean)
          .slice(0, 5)
          .map((line) => line.split(',').map((cell) => cell.trim()));
        setPreview(rows);
      }).catch(() => setPreview([]));
    }
  };

  const downloadSampleCsv = () => {
    const csv = sampleRows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'model-import-apartamente.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const submitImport = async () => {
    setError('');
    setSummary(null);
    if (!file) {
      setError('Alege un fișier CSV sau XLSX.');
      return;
    }
    if (!buildingId) {
      setError(buildings.length ? 'Alege blocul pentru import.' : 'Mai întâi creează un bloc.');
      return;
    }

    const formData = new FormData();
    formData.set('file', file);
    formData.set('buildingId', buildingId);

    setSubmitting(true);
    try {
      const res = await adminImportsApi.importApartments(formData);
      setSummary(res.data);
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut procesa fișierul.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5 pb-6">
      <PageHeader
        title="Import apartamente și locatari"
        description="Încarcă un fișier CSV cu apartamentele, suprafețele și proprietarii/locatarii."
        rightSlot={
          <div className="flex flex-wrap items-center gap-2">
            <Link href={localizedPath('/admin/apartments/bulk-create')} className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-border/70 px-4 py-2 text-sm font-semibold hover:bg-muted/60">
              <Layers3 className="h-4 w-4" />
              Adaugă în masă
            </Link>
            <Link href={localizedPath('/admin/apartments')} className="rounded-2xl border border-border/70 px-4 py-2 text-sm font-semibold hover:bg-muted/60">
              Înapoi la apartamente
            </Link>
          </div>
        }
      />

      <Card className="p-4">
        <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <p className="text-sm font-semibold text-foreground">Fișier CSV/XLSX</p>
            <p className="mt-1 text-sm text-muted-foreground">
              CSV este formatul recomandat pentru MVP. XLSX este acceptat prin parserul existent.
            </p>
            <div className="mt-3 space-y-3">
              <ColumnGroup title="Coloane obligatorii" columns={requiredColumns} />
              <ColumnGroup title="Coloane opționale" columns={optionalColumns} />
            </div>
            <button
              type="button"
              onClick={downloadSampleCsv}
              className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-2xl border border-border/70 px-4 text-sm font-semibold hover:bg-muted/60"
            >
              <Download className="h-4 w-4" />
              Descarcă model CSV
            </button>
          </div>

          <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 p-4">
            <label className="flex cursor-pointer flex-col items-center justify-center gap-3 text-center">
              <UploadCloud className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">{file ? file.name : 'Alege fișier CSV sau XLSX'}</span>
              <span className="text-xs text-muted-foreground">Importul creează date reale în Supabase prin API.</span>
              <input className="sr-only" type="file" accept=".csv,.xlsx,.xls" onChange={onFileChange} />
            </label>
          </div>
        </div>
      </Card>

      {!loadingBuildings && !buildings.length ? (
        <Card className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Building2 className="mt-0.5 h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-semibold text-foreground">Mai întâi creează un bloc.</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Importul conectează apartamentele și scările la un bloc real al A.P.C.
                </p>
              </div>
            </div>
            <Link href={localizedPath('/admin/buildings')} className="inline-flex min-h-10 items-center justify-center rounded-2xl bg-foreground px-4 text-sm font-semibold text-background">
              Adaugă bloc
            </Link>
          </div>
        </Card>
      ) : null}

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
          <label className="block">
            <span className="label">Bloc</span>
            {loadingBuildings ? (
              <LoadingState label="Se încarcă blocurile..." rows={1} />
            ) : (
              <select className="select" value={buildingId} onChange={(event) => setBuildingId(event.target.value)}>
                <option value="">Alege blocul pentru import</option>
                {buildings.map((building) => (
                  <option key={building.id} value={building.id}>{building.name}</option>
                ))}
              </select>
            )}
          </label>
          <button
            type="button"
            onClick={submitImport}
            disabled={submitting || !buildings.length}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-foreground px-5 text-sm font-semibold text-background disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FileSpreadsheet className="h-4 w-4" />
            {submitting ? 'Se importă...' : 'Importă datele'}
          </button>
        </div>
        {selectedBuilding ? <p className="mt-2 text-xs text-muted-foreground">Import în: {selectedBuilding.name}</p> : null}
        {buildings.length ? (
          <p className="mt-2 text-xs text-muted-foreground">Scările din CSV vor fi create automat dacă nu există deja în blocul ales.</p>
        ) : null}
      </Card>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {error}
        </div>
      ) : null}

      {preview.length ? (
        <Card className="overflow-hidden p-0">
          <div className="border-b border-border/70 px-4 py-3">
            <p className="text-sm font-semibold text-foreground">Previzualizare CSV</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <tbody>
                {preview.map((row, index) => (
                  <tr key={`${row.join('-')}-${index}`} className="border-b border-border/50 last:border-0">
                    {row.map((cell, cellIndex) => (
                      <td key={`${cell}-${cellIndex}`} className="px-4 py-2 text-muted-foreground">{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {summary ? (
        <Card className="p-4">
          <p className="text-sm font-semibold text-emerald-700">Importul a fost finalizat.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <SummaryItem label="Apartamente create" value={summary.createdApartments} />
            <SummaryItem label="Apartamente omise" value={summary.skippedApartments} />
            <SummaryItem label="Locatari creați" value={summary.createdResidents} />
            <SummaryItem label="Locatari conectați" value={summary.linkedResidents} />
            <SummaryItem label="Erori" value={summary.errors?.length || 0} />
          </div>
          {summary.createdStaircases ? (
            <p className="mt-3 text-sm text-muted-foreground">Scări create: {summary.createdStaircases}</p>
          ) : null}
          {summary.skippedApartments ? (
            <p className="mt-2 text-sm text-muted-foreground">Apartamentul există deja și a fost omis pentru rândurile duplicate.</p>
          ) : null}
          {summary.errors?.length ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm font-semibold text-amber-800">Rânduri cu erori</p>
              <div className="mt-2 space-y-1 text-sm text-amber-800">
                {summary.errors.slice(0, 8).map((item) => (
                  <p key={item.row}>Rând {item.row}: {item.message || item.messages?.join(' ') || 'Nu am putut procesa rândul.'}</p>
                ))}
              </div>
            </div>
          ) : null}
        </Card>
      ) : !file ? (
        <EmptyState title="Nu ai încă importuri efectuate." description="Descarcă modelul CSV, completează datele reale ale A.P.C. și încarcă fișierul aici." />
      ) : null}
    </div>
  );
}

function ColumnGroup({ title, columns }: { title: string; columns: string[] }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {columns.map((column) => (
          <span key={column} className="rounded-full border border-border/70 bg-muted/30 px-2.5 py-1 text-xs font-semibold text-muted-foreground">
            {column}
          </span>
        ))}
      </div>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-muted/25 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}
