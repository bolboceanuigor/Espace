'use client';

import { ChangeEvent, ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Gauge, History, ListChecks, RotateCcw, UploadCloud, Users, XCircle } from 'lucide-react';
import { Badge, Button, Card, Modal, ModalBody, ModalFooter, ModalHeader, PageHeader, StatCard } from '@/components/ui';
import EmptyState from '@/components/common/EmptyState';
import { importsApi } from '@/lib/api';
import { downloadBlob } from '@/lib/download';
import { useLocalizedPath } from '@/lib/use-localized-path';

type ImportType = 'APARTMENTS' | 'RESIDENTS' | 'METERS' | 'METER_READINGS';
type ImportMode = 'CREATE_ONLY' | 'UPSERT_SAFE';
type TemplateType = 'apartments' | 'residents' | 'meters' | 'meter-readings';
type ImportRow = {
  id: string;
  rowNumber: number;
  status: 'VALID' | 'WARNING' | 'ERROR' | 'SKIPPED' | 'IMPORTED';
  operation: 'CREATE' | 'UPDATE' | 'LINK' | 'SKIP' | 'NONE';
  rawData: Record<string, unknown>;
  normalizedData: Record<string, unknown>;
  errors: string[];
  warnings: string[];
};
type ImportJob = {
  id: string;
  importType: ImportType;
  type: ImportType;
  mode: ImportMode;
  fileName: string;
  status: string;
  delimiter: string;
  totalRows: number;
  validRows: number;
  warningRows: number;
  errorRows: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  errorsCount: number;
  warningsCount: number;
  summary?: Record<string, any>;
  createdAt: string;
  completedAt?: string | null;
  actor?: { fullName?: string; email?: string } | null;
};
type ImportDetail = {
  importJob: ImportJob;
  summary: Record<string, any>;
  previewRows: ImportRow[];
};

const modeLabels: Record<ImportMode, string> = {
  CREATE_ONLY: 'Creează doar date noi',
  UPSERT_SAFE: 'Creează și actualizează sigur',
};

const statusTone: Record<string, 'success' | 'warning' | 'error' | 'neutral'> = {
  VALID: 'success',
  WARNING: 'warning',
  ERROR: 'error',
  SKIPPED: 'neutral',
  IMPORTED: 'success',
  COMPLETED: 'success',
  VALIDATED: 'warning',
  PROCESSING: 'warning',
  FAILED: 'error',
  CANCELLED: 'neutral',
};

export function AdminImportsPage() {
  const localizedPath = useLocalizedPath();
  const [history, setHistory] = useState<ImportJob[]>([]);

  useEffect(() => {
    importsApi
      .list({ limit: 5 })
      .then((response) => setHistory(response.data?.items || []))
      .catch(() => setHistory([]));
  }, []);

  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        title="Importuri"
        description="Importă apartamente și locatari din fișiere CSV, cu verificare înainte de salvare."
        rightSlot={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral">CSV</Badge>
            <Link href={localizedPath('/admin/imports/history')} className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-border/70 px-4 text-sm font-semibold hover:bg-muted/60">
              <History className="h-4 w-4" />
              Istoric importuri
            </Link>
          </div>
        }
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <ImportCard
          title="Import apartamente"
          description="Încarcă numere, scări, etaje, suprafețe și statusuri pentru apartamente."
          href="/admin/imports/apartments"
          template="apartments"
          action="Importă apartamente"
          icon={<FileSpreadsheet className="h-5 w-5" />}
        />
        <ImportCard
          title="Import locatari/proprietari"
          description="Încarcă persoane, contacte și relații cu apartamentele existente."
          href="/admin/imports/residents"
          template="residents"
          action="Importă persoane"
          icon={<Users className="h-5 w-5" />}
        />
        <ImportCard
          title="Import contoare"
          description="Importă contoarele apartamentelor dintr-un fișier CSV."
          href="/admin/imports/meters"
          template="meters"
          action="Importă contoare"
          icon={<Gauge className="h-5 w-5" />}
        />
        <ImportCard
          title="Import indici contoare"
          description="Importă indicii inițiali sau lunari pentru contoarele existente."
          href="/admin/imports/meter-readings"
          template="meter-readings"
          action="Importă indici"
          icon={<ListChecks className="h-5 w-5" />}
        />
        <Card className="p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted/45">
            <History className="h-5 w-5" />
          </div>
          <h2 className="mt-4 text-base font-semibold text-foreground">Istoric importuri</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Vezi preview-uri, rezultate, rânduri validate și importuri anulate.</p>
          <Link href={localizedPath('/admin/imports/history')} className="mt-5 inline-flex min-h-10 items-center justify-center rounded-2xl border border-border/70 px-4 text-sm font-semibold hover:bg-muted/60">
            Vezi istoricul
          </Link>
        </Card>
        <Card className="p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted/45">
            <Download className="h-5 w-5" />
          </div>
          <h2 className="mt-4 text-base font-semibold text-foreground">Template-uri CSV</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Descarcă fișierele model pentru completarea datelor în format sigur.</p>
          <div className="mt-5 grid gap-2">
            <TemplateButton type="apartments" label="Template apartamente" />
            <TemplateButton type="residents" label="Template locatari" />
            <TemplateButton type="meters" label="Template contoare" />
            <TemplateButton type="meter-readings" label="Template indici" />
          </div>
        </Card>
      </section>

      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">Importul nu șterge date existente</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Datele sunt aplicate doar după preview și confirmare explicită. Nu există REPLACE_ALL în acest MVP.
            </p>
          </div>
          <Badge variant="warning">Excel .xlsx în curând</Badge>
        </div>
      </Card>

      {history.length ? (
        <Card className="overflow-hidden p-0">
          <div className="border-b border-border/70 px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">Ultimele importuri</h2>
          </div>
          <div className="divide-y divide-border/60">
            {history.map((job) => (
              <Link key={job.id} href={localizedPath(`/admin/imports/${job.id}`)} className="grid gap-2 px-4 py-3 text-sm hover:bg-muted/35 md:grid-cols-[1fr_0.8fr_0.8fr_0.8fr]">
                <span className="font-semibold text-foreground">{job.fileName}</span>
                <span className="text-muted-foreground">{job.importType}</span>
                <Badge variant={statusTone[job.status] || 'neutral'}>{job.status}</Badge>
                <span className="text-muted-foreground">{formatDate(job.createdAt)}</span>
              </Link>
            ))}
          </div>
        </Card>
      ) : (
        <EmptyState
          title="Nu există importuri"
          description="Importurile de apartamente și locatari vor apărea aici după ce încarci primul fișier CSV."
        />
      )}
    </div>
  );
}

function ImportCard({ title, description, href, template, action, icon }: { title: string; description: string; href: string; template: TemplateType; action: string; icon: ReactNode }) {
  const localizedPath = useLocalizedPath();
  return (
    <Card className="flex h-full flex-col justify-between p-4">
      <div>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted/45 text-foreground">{icon}</div>
        <h2 className="mt-4 text-base font-semibold text-foreground">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant="neutral">CSV</Badge>
          <Badge variant="neutral">Excel .xlsx în curând</Badge>
        </div>
      </div>
      <div className="mt-5 grid gap-2">
        <Link href={localizedPath(href)} className="inline-flex min-h-10 items-center justify-center rounded-2xl bg-foreground px-4 text-sm font-semibold text-background">
          {action}
        </Link>
        <TemplateButton type={template} label="Descarcă template" compact />
      </div>
    </Card>
  );
}

export function AdminCsvImportPage({ type }: { type: ImportType }) {
  const localizedPath = useLocalizedPath();
  const isResidents = type === 'RESIDENTS';
  const isMeters = type === 'METERS';
  const isMeterReadings = type === 'METER_READINGS';
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<ImportMode>('CREATE_ONLY');
  const [delimiter, setDelimiter] = useState(';');
  const [primaryContactStrategy, setPrimaryContactStrategy] = useState('KEEP_FIRST');
  const [defaultRole, setDefaultRole] = useState('OWNER');
  const [defaultStatus, setDefaultStatus] = useState(isResidents ? 'ACTIVE' : '');
  const [duplicateApprovedPolicy, setDuplicateApprovedPolicy] = useState('ERROR');
  const [lowerThanPreviousPolicy, setLowerThanPreviousPolicy] = useState('MARK_NEEDS_REVIEW');
  const [createMissingMeters, setCreateMissingMeters] = useState(false);
  const [detail, setDetail] = useState<ImportDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const [approvedChecked, setApprovedChecked] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const job = detail?.importJob;
  const rows = detail?.previewRows || [];
  const hasErrors = Boolean(job && Number(job.errorRows || 0) > 0);
  const isCompleted = job?.status === 'COMPLETED' || job?.status === 'IMPORTED';
  const hasApprovedReadings = isMeterReadings && rows.some((row) => String(row.normalizedData?.status || '').toUpperCase() === 'APPROVED');
  const sourceHref = isResidents ? '/admin/residents' : isMeters ? '/admin/meters' : isMeterReadings ? '/admin/meter-readings' : '/admin/apartments';
  const templateType: TemplateType = isResidents ? 'residents' : isMeters ? 'meters' : isMeterReadings ? 'meter-readings' : 'apartments';
  const pageTitle = isResidents ? 'Import locatari/proprietari' : isMeters ? 'Import contoare' : isMeterReadings ? 'Import indici contoare' : 'Import apartamente';
  const pageDescription = isResidents
    ? 'Încarcă persoane și relații apartament-locatar din CSV.'
    : isMeters
      ? 'Încarcă contoarele apartamentelor din CSV.'
      : isMeterReadings
        ? 'Încarcă indici inițiali sau lunari pentru contoarele existente.'
        : 'Încarcă apartamentele asociației din CSV.';

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] || null);
    setDetail(null);
    setError('');
    setSuccess('');
  }

  async function previewImport() {
    setError('');
    setSuccess('');
    if (!file) {
      setError('Alege fișierul CSV.');
      return;
    }
    const formData = new FormData();
    formData.set('file', file);
    formData.set('mode', mode);
    formData.set('delimiter', delimiter);
    if (isResidents) {
      formData.set('primaryContactStrategy', primaryContactStrategy);
      formData.set('defaultRole', defaultRole);
      formData.set('defaultStatus', defaultStatus);
    }
    if (isMeterReadings) {
      formData.set('defaultStatus', defaultStatus || 'APPROVED');
      formData.set('duplicateApprovedPolicy', duplicateApprovedPolicy);
      formData.set('lowerThanPreviousPolicy', lowerThanPreviousPolicy);
      formData.set('createMissingMeters', String(createMissingMeters));
    }
    setLoading(true);
    try {
      const response = isResidents
        ? await importsApi.previewResidents(formData)
        : isMeters
          ? await importsApi.previewMeters(formData)
          : isMeterReadings
            ? await importsApi.previewMeterReadings(formData)
            : await importsApi.previewApartments(formData);
      setDetail(response.data);
      setSuccess('Preview-ul a fost generat. Verifică rândurile înainte de confirmare.');
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut genera preview-ul.'));
    } finally {
      setLoading(false);
    }
  }

  async function confirmImport() {
    if (!job) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const response = isResidents
        ? await importsApi.confirmResidents(job.id)
        : isMeters
          ? await importsApi.confirmMeters(job.id)
          : isMeterReadings
            ? await importsApi.confirmMeterReadings(job.id)
            : await importsApi.confirmApartments(job.id);
      setDetail(response.data);
      setConfirmOpen(false);
      setChecked(false);
      setApprovedChecked(false);
      setSuccess('Importul a fost finalizat. Verifică datele importate înainte de facturare.');
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut confirma importul.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        title={pageTitle}
        description={pageDescription}
        rightSlot={
          <div className="flex flex-wrap items-center gap-2">
            <TemplateButton type={templateType} label="Descarcă template CSV" />
            <Link href={localizedPath(sourceHref)} className="inline-flex min-h-10 items-center justify-center rounded-2xl border border-border/70 px-4 text-sm font-semibold hover:bg-muted/60">
              Înapoi
            </Link>
          </div>
        }
      />

      <section className="grid gap-3 md:grid-cols-4">
        {['Încarcă fișier', 'Verifică datele', 'Confirmă importul', 'Rezultat'].map((step, index) => (
          <Card key={step} className={`p-3 ${index === activeStep(job, rows.length) ? 'border-foreground/30 bg-muted/25' : ''}`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pas {index + 1}</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{step}</p>
          </Card>
        ))}
      </section>

      <Card className="p-4">
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div>
            <h2 className="text-base font-semibold text-foreground">Fișier CSV</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Importul nu șterge date existente. Datele sunt aplicate doar după confirmare.
            </p>
            <label className="mt-4 flex min-h-36 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/80 bg-muted/20 px-4 text-center">
              <UploadCloud className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">{file ? file.name : 'Alege fișier .csv'}</span>
              <span className="text-xs text-muted-foreground">Limită MVP: 5 MB și 5.000 rânduri.</span>
              <input className="sr-only" type="file" accept=".csv,text/csv" onChange={onFileChange} />
            </label>
          </div>
          <div className="grid gap-3">
            <Select label="Delimiter" value={delimiter} onChange={setDelimiter} options={[';', ',']} labels={{ ';': 'Semicolon ;', ',': 'Comma ,' }} />
            <Select label="Mod import" value={mode} onChange={(value) => setMode(value as ImportMode)} options={['CREATE_ONLY', 'UPSERT_SAFE']} labels={modeLabels} />
            {isResidents ? (
              <>
                <Select label="Contact principal" value={primaryContactStrategy} onChange={setPrimaryContactStrategy} options={['KEEP_FIRST', 'LAST_WINS', 'ERROR']} labels={{ KEEP_FIRST: 'Păstrează primul', LAST_WINS: 'Ultimul câștigă', ERROR: 'Blochează duplicatul' }} />
                <Select label="Rol implicit" value={defaultRole} onChange={setDefaultRole} options={['OWNER', 'TENANT', 'REPRESENTATIVE']} labels={{ OWNER: 'Proprietar', TENANT: 'Chiriaș', REPRESENTATIVE: 'Reprezentant' }} />
                <Select label="Status implicit" value={defaultStatus} onChange={setDefaultStatus} options={['ACTIVE', 'INVITED', 'NOT_INVITED', 'INACTIVE']} labels={{ ACTIVE: 'Activ', INVITED: 'Invitat', NOT_INVITED: 'Neinvitat', INACTIVE: 'Inactiv' }} />
              </>
            ) : null}
            {isMeterReadings ? (
              <>
                <Select label="Status implicit indici" value={defaultStatus || 'APPROVED'} onChange={setDefaultStatus} options={['APPROVED', 'SUBMITTED', 'NEEDS_REVIEW']} labels={{ APPROVED: 'Aprobat', SUBMITTED: 'În așteptare', NEEDS_REVIEW: 'Needs review' }} />
                <Select label="Duplicate APPROVED" value={duplicateApprovedPolicy} onChange={setDuplicateApprovedPolicy} options={['ERROR', 'SKIP', 'UPDATE_ONLY_IF_NOT_FINAL']} labels={{ ERROR: 'Blochează', SKIP: 'Omite rândul', UPDATE_ONLY_IF_NOT_FINAL: 'Update doar nefinalizat' }} />
                <Select label="Valoare sub precedent" value={lowerThanPreviousPolicy} onChange={setLowerThanPreviousPolicy} options={['MARK_NEEDS_REVIEW', 'ERROR']} labels={{ MARK_NEEDS_REVIEW: 'Marchează needs review', ERROR: 'Blochează' }} />
                <label className="flex min-h-11 items-center gap-2 rounded-2xl border border-border/70 px-3 text-sm font-medium text-foreground">
                  <input type="checkbox" checked={createMissingMeters} onChange={(event) => setCreateMissingMeters(event.target.checked)} />
                  Creează contoare lipsă
                </label>
              </>
            ) : null}
            <Button onClick={previewImport} isLoading={loading}>
              Generează preview
            </Button>
          </div>
        </div>
      </Card>

      {success ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>{success}</span>
            <Link href={localizedPath('/admin/data-quality')} className="inline-flex min-h-9 items-center justify-center rounded-2xl border border-emerald-300 bg-white px-3 text-xs font-semibold text-emerald-800 hover:bg-emerald-50">
              Rulează verificări date
            </Link>
            <Link href={localizedPath('/admin/data-quality/fixes')} className="inline-flex min-h-9 items-center justify-center rounded-2xl border border-emerald-300 bg-white px-3 text-xs font-semibold text-emerald-800 hover:bg-emerald-50">
              Vezi probleme remediabile
            </Link>
          </div>
        </div>
      ) : null}
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}

      {job ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <StatCard label="Total rânduri" value={job.totalRows} description={job.fileName} icon={<FileSpreadsheet className="h-5 w-5" />} />
            <StatCard label="Valide" value={job.validRows} description="Fără erori critice" icon={<CheckCircle2 className="h-5 w-5" />} tone="success" />
            <StatCard label="Warnings" value={job.warningRows} description="Se pot importa" icon={<AlertTriangle className="h-5 w-5" />} tone="warning" />
            <StatCard label="Erori" value={job.errorRows} description="Blochează confirmarea" icon={<XCircle className="h-5 w-5" />} tone={job.errorRows ? 'danger' : 'success'} />
            <StatCard label="De creat" value={job.createdCount} description="Estimare preview" icon={<CheckCircle2 className="h-5 w-5" />} />
            <StatCard label="De actualizat" value={job.updatedCount} description={modeLabels[job.mode]} icon={<RotateCcw className="h-5 w-5" />} />
          </section>

          <PreviewTable rows={rows} />

          <Card className="p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {hasErrors ? 'Importul are erori' : isCompleted ? 'Import finalizat' : 'Gata de confirmare'}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {hasErrors ? 'Corectează rândurile marcate cu eroare sau încarcă un fișier nou.' : 'Confirmarea aplică doar rândurile valide și cu warnings.'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={localizedPath(`/admin/imports/${job.id}`)} className="inline-flex min-h-10 items-center justify-center rounded-2xl border border-border/70 px-4 text-sm font-semibold hover:bg-muted/60">
                  Detalii import
                </Link>
                <Button disabled={hasErrors || isCompleted} onClick={() => setConfirmOpen(true)}>
                  Confirmă importul
                </Button>
              </div>
            </div>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Fișierul nu conține rânduri validate încă"
          description="Încarcă un CSV și generează preview-ul înainte de confirmarea importului."
        />
      )}

      <Modal isOpen={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="lg">
        <ModalHeader title="Confirmă importul" onClose={() => setConfirmOpen(false)} />
        <ModalBody>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>Vor fi procesate rândurile valide și cele cu warnings. Rândurile cu erori nu pot fi importate.</p>
            <div className="rounded-2xl border border-border/70 bg-muted/25 p-3">
              <p>{isMeterReadings ? 'Indici' : isMeters ? 'Contoare' : 'Apartamente/persoane'} de creat: <strong>{job?.createdCount || 0}</strong></p>
              <p>{isMeterReadings ? 'Indici' : isMeters ? 'Contoare' : 'Apartamente/persoane'} de actualizat: <strong>{job?.updatedCount || 0}</strong></p>
              {isMeterReadings ? (
                <>
                  <p>Indici APPROVED: <strong>{detail?.summary?.approvedReadingsCount || rows.filter((row) => row.normalizedData?.status === 'APPROVED').length}</strong></p>
                  <p>Indici SUBMITTED: <strong>{detail?.summary?.submittedReadingsCount || rows.filter((row) => row.normalizedData?.status === 'SUBMITTED').length}</strong></p>
                  <p>NEEDS_REVIEW: <strong>{detail?.summary?.needsReviewReadingsCount || rows.filter((row) => row.normalizedData?.status === 'NEEDS_REVIEW').length}</strong></p>
                  <p>Contoare lipsă de creat: <strong>{detail?.summary?.createdMetersCount || rows.filter((row) => row.normalizedData?.createMissingMeter).length}</strong></p>
                </>
              ) : null}
              <p>Warnings: <strong>{job?.warningRows || 0}</strong></p>
            </div>
            <label className="flex items-start gap-2 rounded-2xl border border-border/70 p-3 text-foreground">
              <input className="mt-1" type="checkbox" checked={checked} onChange={(event) => setChecked(event.target.checked)} />
              <span>{isMeterReadings ? 'Confirm că am verificat datele și vreau să aplic importul indicilor.' : isMeters ? 'Confirm că am verificat datele și vreau să aplic importul contoarelor.' : 'Confirm că am verificat datele și vreau să aplic importul.'}</span>
            </label>
            {hasApprovedReadings ? (
              <label className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-amber-900">
                <input className="mt-1" type="checkbox" checked={approvedChecked} onChange={(event) => setApprovedChecked(event.target.checked)} />
                <span>Înțeleg că indicii aprobați pot fi folosiți ulterior la calculul tarifelor pe consum.</span>
              </label>
            ) : null}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setConfirmOpen(false)} disabled={loading}>Anulează</Button>
          <Button onClick={confirmImport} disabled={!checked || (hasApprovedReadings && !approvedChecked) || loading} isLoading={loading}>Aplică importul</Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

export function AdminImportHistoryPage() {
  const localizedPath = useLocalizedPath();
  const [items, setItems] = useState<ImportJob[]>([]);
  const [type, setType] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    importsApi
      .list({ importType: type === 'ALL' ? undefined : type, status: status === 'ALL' ? undefined : status, limit: 50 })
      .then((response) => setItems(response.data?.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [type, status]);

  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        title="Istoric importuri"
        description="Vezi ultimele importuri generate, statusul și rezultatul fiecărui job."
        rightSlot={<Link href={localizedPath('/admin/imports')} className="rounded-2xl border border-border/70 px-4 py-2 text-sm font-semibold hover:bg-muted/60">Înapoi la importuri</Link>}
      />
      <Card className="grid gap-3 md:grid-cols-2">
          <Select label="Tip import" value={type} onChange={setType} options={['ALL', 'APARTMENTS', 'RESIDENTS', 'METERS', 'METER_READINGS']} labels={{ ALL: 'Toate tipurile', APARTMENTS: 'Apartamente', RESIDENTS: 'Locatari', METERS: 'Contoare', METER_READINGS: 'Indici contoare' }} />
        <Select label="Status" value={status} onChange={setStatus} options={['ALL', 'VALIDATED', 'COMPLETED', 'FAILED', 'CANCELLED']} labels={{ ALL: 'Toate statusurile', VALIDATED: 'Validat', COMPLETED: 'Finalizat', FAILED: 'Eșuat', CANCELLED: 'Anulat' }} />
      </Card>
      {loading ? <Card className="h-32 animate-pulse bg-muted/35" /> : null}
      {!loading && !items.length ? (
        <EmptyState title="Nu există importuri" description="Importurile de apartamente și locatari vor apărea aici după primul preview CSV." />
      ) : null}
      {!loading && items.length ? (
        <Card className="overflow-hidden p-0">
          <div className="hidden grid-cols-[1fr_0.7fr_0.7fr_0.5fr_0.5fr_0.7fr_0.8fr] gap-3 border-b border-border/70 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:grid">
            <span>Fișier</span>
            <span>Tip</span>
            <span>Status</span>
            <span>Rânduri</span>
            <span>Erori</span>
            <span>Creat</span>
            <span>Acțiuni</span>
          </div>
          {items.map((item) => (
            <div key={item.id} className="grid gap-3 border-b border-border/50 px-4 py-4 text-sm last:border-0 md:grid-cols-[1fr_0.7fr_0.7fr_0.5fr_0.5fr_0.7fr_0.8fr] md:items-center">
              <strong className="text-foreground">{item.fileName}</strong>
              <span className="text-muted-foreground">{item.importType}</span>
              <Badge variant={statusTone[item.status] || 'neutral'}>{item.status}</Badge>
              <span className="text-muted-foreground">{item.totalRows}</span>
              <span className="text-muted-foreground">{item.errorRows}</span>
              <span className="text-muted-foreground">{formatDate(item.createdAt)}</span>
              <Link href={localizedPath(`/admin/imports/${item.id}`)} className="rounded-xl border border-border/70 px-3 py-2 text-center text-xs font-semibold hover:bg-muted/60">Deschide</Link>
            </div>
          ))}
        </Card>
      ) : null}
    </div>
  );
}

export function AdminImportDetailsPage({ id }: { id: string }) {
  const localizedPath = useLocalizedPath();
  const [detail, setDetail] = useState<ImportDetail | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [status, setStatus] = useState('ALL');
  const [error, setError] = useState('');

  useEffect(() => {
    importsApi
      .get(id)
      .then((response) => setDetail(response.data))
      .catch((err: any) => setError(String(err?.message || 'Nu am putut încărca importul.')));
  }, [id]);

  useEffect(() => {
    importsApi
      .rows(id, { status: status === 'ALL' ? undefined : status, limit: 100 })
      .then((response) => setRows(response.data?.items || []))
      .catch(() => setRows([]));
  }, [id, status]);

  const job = detail?.importJob;

  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        title="Detalii import"
        description={job ? `${job.fileName} · ${job.importType}` : 'Verifică statusul importului și rândurile procesate.'}
        rightSlot={<Link href={localizedPath('/admin/imports/history')} className="rounded-2xl border border-border/70 px-4 py-2 text-sm font-semibold hover:bg-muted/60">Istoric importuri</Link>}
      />
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}
      {job ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <StatCard label="Status" value={job.status} description={job.mode} icon={<FileSpreadsheet className="h-5 w-5" />} />
            <StatCard label="Total rânduri" value={job.totalRows} description="CSV" icon={<FileSpreadsheet className="h-5 w-5" />} />
            <StatCard label="Warnings" value={job.warningRows} description={`${job.warningsCount} avertizări`} icon={<AlertTriangle className="h-5 w-5" />} tone="warning" />
            <StatCard label="Erori" value={job.errorRows} description={`${job.errorsCount} erori`} icon={<XCircle className="h-5 w-5" />} tone={job.errorRows ? 'danger' : 'success'} />
            <StatCard label="Create" value={job.createdCount} description="Aplicate/estimate" icon={<CheckCircle2 className="h-5 w-5" />} />
            <StatCard label="Actualizate" value={job.updatedCount} description="UPSERT_SAFE" icon={<RotateCcw className="h-5 w-5" />} />
          </section>
          <Card>
            <Select label="Filtrează rânduri" value={status} onChange={setStatus} options={['ALL', 'VALID', 'WARNING', 'ERROR', 'SKIPPED', 'IMPORTED']} labels={{ ALL: 'Toate rândurile', VALID: 'Valide', WARNING: 'Warnings', ERROR: 'Erori', SKIPPED: 'Omise', IMPORTED: 'Importate' }} />
          </Card>
          <PreviewTable rows={rows.length ? rows : detail.previewRows || []} />
        </>
      ) : (
        <Card className="h-32 animate-pulse bg-muted/35" />
      )}
    </div>
  );
}

function PreviewTable({ rows }: { rows: ImportRow[] }) {
  if (!rows.length) {
    return <EmptyState title="Fișierul nu conține rânduri valide" description="Verifică template-ul și încarcă din nou fișierul." />;
  }
  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-border/70 px-4 py-3">
        <p className="text-sm font-semibold text-foreground">Preview rânduri</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border/70 bg-muted/30 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3">Rând</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Operație</th>
              <th className="px-4 py-3">Date principale</th>
              <th className="px-4 py-3">Warnings</th>
              <th className="px-4 py-3">Erori</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id || row.rowNumber} className="border-b border-border/50 align-top last:border-0">
                <td className="px-4 py-3 font-medium text-foreground">{row.rowNumber}</td>
                <td className="px-4 py-3"><Badge variant={statusTone[row.status] || 'neutral'}>{row.status}</Badge></td>
                <td className="px-4 py-3 text-muted-foreground">{row.operation}</td>
                <td className="max-w-[360px] px-4 py-3 text-muted-foreground">{compactRow(row.normalizedData || row.rawData)}</td>
                <td className="max-w-[320px] px-4 py-3 text-amber-700">{(row.warnings || []).join(' ') || '-'}</td>
                <td className="max-w-[320px] px-4 py-3 text-rose-700">{(row.errors || []).join(' ') || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function TemplateButton({ type, label, compact = false }: { type: TemplateType; label: string; compact?: boolean }) {
  const [loading, setLoading] = useState(false);
  async function download() {
    setLoading(true);
    try {
      const response =
        type === 'apartments'
          ? await importsApi.apartmentsTemplateCsv()
          : type === 'residents'
            ? await importsApi.residentsTemplateCsv()
            : type === 'meters'
              ? await importsApi.metersTemplateCsv()
              : await importsApi.meterReadingsTemplateCsv();
      const fileName =
        type === 'apartments'
          ? 'template-apartamente.csv'
          : type === 'residents'
            ? 'template-locatari.csv'
            : type === 'meters'
              ? 'template-contoare.csv'
              : 'template-indici-contoare.csv';
      downloadBlob(response.data, fileName);
    } finally {
      setLoading(false);
    }
  }
  return (
    <button
      type="button"
      onClick={download}
      disabled={loading}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl border border-border/70 px-4 text-sm font-semibold hover:bg-muted/60 disabled:opacity-60 ${compact ? 'w-full' : ''}`}
    >
      <Download className="h-4 w-4" />
      {loading ? 'Se descarcă...' : label}
    </button>
  );
}

function Select({ label, value, onChange, options, labels }: { label: string; value: string; onChange: (value: string) => void; options: string[]; labels?: Record<string, string> }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full rounded-2xl border border-border/70 bg-white px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-foreground/10">
        {options.map((item) => <option key={item} value={item}>{labels?.[item] || item}</option>)}
      </select>
    </label>
  );
}

function activeStep(job: ImportJob | undefined, rowsCount: number) {
  if (!job) return 0;
  if (job.status === 'COMPLETED' || job.status === 'IMPORTED') return 3;
  if (rowsCount) return 1;
  return 0;
}

function compactRow(value: Record<string, unknown>) {
  const picked = ['apartmentNumber', 'fullName', 'phone', 'email', 'building', 'staircase', 'floor', 'areaM2', 'role', 'meterType', 'meterNumber', 'periodMonth', 'readingValue', 'previousReadingValue', 'consumptionValue', 'unit', 'status']
    .map((key) => {
      const entry = value?.[key];
      return entry === undefined || entry === null || entry === '' ? '' : `${key}: ${entry}`;
    })
    .filter(Boolean);
  return picked.join(' · ') || JSON.stringify(value || {});
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('ro-RO');
}
