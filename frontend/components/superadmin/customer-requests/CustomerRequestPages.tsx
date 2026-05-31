'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { BarChart3, Kanban, RefreshCw, Search } from 'lucide-react';
import { Button, Card, EmptyState, LoadingSkeleton, PageHeader, StatCard } from '@/components/ui';
import { accessRequestsApi, superadminApi } from '@/lib/api';
import { useLocalizedPath } from '@/lib/use-localized-path';

const statuses = ['NEW', 'CONTACTED', 'QUALIFIED', 'ONBOARDING', 'CONVERTED', 'REJECTED'];
const statusLabels: Record<string, string> = {
  NEW: 'Noi',
  CONTACTED: 'Contactate',
  QUALIFIED: 'Calificate',
  IN_ONBOARDING: 'În onboarding',
  ONBOARDING: 'În onboarding',
  CONVERTED: 'Convertite',
  CLOSED: 'Respinse',
  REJECTED: 'Respinse',
  SPAM: 'Spam',
};
const priorityLabels: Record<string, string> = { LOW: 'Scăzută', NORMAL: 'Normală', HIGH: 'Ridicată' };
const typeLabels: Record<string, string> = { APC: 'APC', ADMINISTRATOR: 'Administrator', PROPERTY_MANAGER: 'Manager proprietăți', OTHER: 'Altceva' };
const emptyConvertForm = {
  organizationName: '',
  legalName: '',
  shortName: '',
  apcCode: '',
  city: '',
  address: '',
  adminName: '',
  adminPhone: '',
  adminEmail: '',
  sendInvite: true,
  note: '',
};

function fmt(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('ro-MD', { day: '2-digit', month: 'short', year: 'numeric' });
}

function Badge({ value, tone = 'slate' }: { value: string; tone?: 'slate' | 'emerald' | 'amber' | 'red' }) {
  const classes = {
    slate: 'border-slate-200/80 bg-slate-50 text-slate-700',
    emerald: 'border-emerald-200/80 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-200/80 bg-amber-50 text-amber-700',
    red: 'border-rose-200/80 bg-rose-50 text-rose-700',
  };
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${classes[tone]}`}>{value}</span>;
}

export function CustomerRequestsListPage({ kanban = false, statsOnly = false, basePath = '/superadmin/customer-requests', title = 'Cereri acces', subtitle = 'Procesează cererile primite de la APC-uri și administratori interesați de Espace.' }: { kanban?: boolean; statsOnly?: boolean; basePath?: string; title?: string; subtitle?: string }) {
  const localizedPath = useLocalizedPath();
  const [data, setData] = useState<any>({ items: [], stats: {} });
  const [filters, setFilters] = useState({ search: '', status: '', city: '', type: '', priority: '' });
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    const res = await accessRequestsApi.getSuperadminAccessRequests({
      search: filters.search || undefined,
      status: filters.status || undefined,
      city: filters.city || undefined,
      type: filters.type || undefined,
      priority: filters.priority || undefined,
    });
    setData(res.data || res);
    setLoading(false);
  }, [filters.city, filters.priority, filters.search, filters.status, filters.type]);
  useEffect(() => { load().catch(() => setLoading(false)); }, [load]);

  const items = data.items || [];
  const stats = data.stats || {};
  if (statsOnly) {
    return (
      <div className="space-y-5 pb-4">
        <PageHeader title="Statistici cereri acces" description="Volum, status și conversii pentru cererile reale primite." />
        <StatsGrid stats={stats} />
      </div>
    );
  }
  if (kanban) {
    return (
      <div className="space-y-5 pb-4">
        <Header title="Kanban cereri acces" subtitle="Urmărește cererile pe etape." basePath={basePath} />
        <div className="grid gap-4 lg:grid-cols-3 xl:grid-cols-6">
          {statuses.filter((item) => item !== 'SPAM').map((column) => (
            <Card key={column} className="p-3">
              <h2 className="text-sm font-semibold text-foreground">{statusLabels[column]}</h2>
              <div className="mt-3 space-y-2">
                {items.filter((item: any) => item.status === column).map((item: any) => (
                  <Link key={item.id} href={localizedPath(`${basePath}/${item.id}`)} className="block rounded-2xl border border-border/70 p-3 transition hover:border-foreground/15 hover:bg-muted/40">
                    <p className="text-sm font-semibold text-foreground">{item.associationName || item.legalName || item.fullName}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{item.fullName} · {item.phone}</p>
                  </Link>
                ))}
                {!items.filter((item: any) => item.status === column).length ? <p className="rounded-2xl border border-dashed border-border/70 p-3 text-xs text-muted-foreground">Nu există cereri în această etapă.</p> : null}
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-5 pb-4">
      <Header title={title} subtitle={subtitle} basePath={basePath} />
      <StatsGrid stats={stats} />
      <Card>
        <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_160px_170px_170px_150px_auto]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={filters.search} onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))} placeholder="Caută nume, telefon, email, asociație..." className="input pl-9" />
          </label>
            <input value={filters.city} onChange={(e) => setFilters((prev) => ({ ...prev, city: e.target.value }))} placeholder="Oraș" className="input" />
            <select value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))} className="select">
              <option value="">Toate statusurile</option>
              {statuses.map((item) => <option key={item} value={item}>{statusLabels[item]}</option>)}
            </select>
            <select value={filters.type} onChange={(e) => setFilters((prev) => ({ ...prev, type: e.target.value }))} className="select">
              <option value="">Toate tipurile</option>
              {Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select value={filters.priority} onChange={(e) => setFilters((prev) => ({ ...prev, priority: e.target.value }))} className="select">
              <option value="">Prioritate</option>
              {Object.keys(priorityLabels).map((item) => <option key={item} value={item}>{priorityLabels[item]}</option>)}
            </select>
            <Button onClick={load} isLoading={loading}>
              <RefreshCw className="h-4 w-4" />
              Filtrează
            </Button>
          </div>
          {loading ? <LoadingSkeleton variant="table" rows={4} /> : null}
          {!loading && !items.length ? (
            <EmptyState
              type="users"
              title="Nu există cereri de acces încă."
              description="Când cineva completează formularul Cere acces, cererea va apărea aici."
            />
          ) : null}
          {items.length ? (
            <div className="overflow-x-auto rounded-2xl border border-border/70">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="bg-muted/45 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground"><tr><th className="p-3">Data</th><th>Contact</th><th>Telefon</th><th>Oraș</th><th>Tip</th><th>Asociație</th><th>Apartamente</th><th>Status</th><th>Prioritate</th><th>Acțiuni</th></tr></thead>
                <tbody className="divide-y divide-border/50">
                  {items.map((item: any) => (
                    <tr key={item.id} className="transition hover:bg-muted/40">
                      <td className="p-3">{fmt(item.createdAt)}</td>
                      <td className="font-medium text-foreground">{item.fullName}</td>
                      <td>{item.phone}</td>
                      <td>{item.city || '-'}</td>
                      <td>{typeLabels[item.type] || item.type || '-'}</td>
                      <td>{item.associationName || item.legalName || '-'}</td>
                      <td>{item.apartmentsCount || '-'}</td>
                      <td><Badge value={statusLabels[item.status] || item.status} tone={item.status === 'NEW' ? 'amber' : item.status === 'CONVERTED' ? 'emerald' : 'slate'} /></td>
                      <td><Badge value={priorityLabels[item.priority] || item.priority} tone={item.priority === 'HIGH' ? 'red' : 'slate'} /></td>
                      <td><Link href={localizedPath(`${basePath}/${item.id}`)} className="font-semibold text-foreground hover:underline">Deschide</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
      </Card>
    </div>
  );
}

function Header({ title, subtitle, basePath }: { title: string; subtitle: string; basePath: string }) {
  const localizedPath = useLocalizedPath();
  return (
    <PageHeader
      title={title}
      description={subtitle}
      rightSlot={
        <div className="flex flex-wrap gap-2">
          <Link href={localizedPath(`${basePath}/kanban`)} className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-border/80 bg-card px-3 text-sm font-semibold text-foreground shadow-sm transition hover:bg-muted/65">
            <Kanban className="h-4 w-4" />
            Kanban
          </Link>
          <Link href={localizedPath('/superadmin/customer-requests/stats')} className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-border/80 bg-card px-3 text-sm font-semibold text-foreground shadow-sm transition hover:bg-muted/65">
            <BarChart3 className="h-4 w-4" />
            Statistici
          </Link>
        </div>
      }
    />
  );
}

function StatsGrid({ stats }: { stats: any }) {
  const cards = [
    ['Noi', stats.NEW || 0],
    ['Contactate', stats.CONTACTED || 0],
    ['Calificate', stats.QUALIFIED || 0],
    ['În onboarding', (stats.ONBOARDING || 0) + (stats.IN_ONBOARDING || 0)],
    ['Convertite', stats.CONVERTED || 0],
    ['Respinse', (stats.REJECTED || 0) + (stats.CLOSED || 0)],
    ['Cereri luna curentă', stats.currentMonth || 0],
    ['Ultima cerere', fmt(stats.lastRequestAt)],
  ];
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{cards.map(([label, value]) => <StatCard key={label as string} label={label as string} value={value} />)}</div>;
}

export function CustomerRequestDetailsPage({ basePath = '/superadmin/customer-requests' }: { basePath?: string }) {
  const params = useParams<{ id: string }>();
  const localizedPath = useLocalizedPath();
  const [item, setItem] = useState<any>(null);
  const [internalNote, setInternalNote] = useState('');
  const [convertOpen, setConvertOpen] = useState(false);
  const [convertForm, setConvertForm] = useState(emptyConvertForm);
  const [converting, setConverting] = useState(false);
  const [convertError, setConvertError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [conversionResult, setConversionResult] = useState<any>(null);
  const [activity, setActivity] = useState<any[]>([]);
  const load = useCallback(async () => {
    const [response, activityResponse] = await Promise.all([
      accessRequestsApi.getSuperadminAccessRequest(params.id),
      superadminApi.getSuperadminActivity({ accessRequestId: params.id, limit: 8 }).catch(() => null),
    ]);
    const next = response.data;
    const activityPayload = activityResponse?.data || {};
    setItem(next);
    setInternalNote(next?.internalNotes || '');
    setActivity((activityPayload.items || activityPayload.data || []) as any[]);
  }, [params.id]);
  useEffect(() => { if (params.id) load().catch(() => {}); }, [params.id, load]);
  if (!item) return <LoadingSkeleton variant="page" rows={3} label="Se încarcă cererea..." />;
  const update = async (payload: Record<string, unknown>) => { await accessRequestsApi.updateSuperadminAccessRequest(item.id, payload); await load(); };
  const updateStatus = async (status: string) => update({ status });
  const convertedOrganizationId = item.convertedOrganizationId || item.convertedOrganization?.id || item.convertedAssociationId || item.convertedAssociation?.id;
  const isConverted = item.status === 'CONVERTED' || !!convertedOrganizationId;

  const openConvertModal = () => {
    setConvertForm({
      organizationName: item.associationName || item.legalName || '',
      legalName: item.legalName || item.associationName || '',
      shortName: item.associationName || item.legalName || '',
      apcCode: item.apcCode || item.associationCode || '',
      city: item.city || '',
      address: item.address || '',
      adminName: item.fullName || '',
      adminPhone: item.phone || '',
      adminEmail: item.email || '',
      sendInvite: true,
      note: '',
    });
    setConvertError('');
    setConvertOpen(true);
  };

  const submitConversion = async () => {
    setConvertError('');
    setSuccessMessage('');
    const payload = {
      organizationName: convertForm.organizationName.trim(),
      legalName: convertForm.legalName.trim() || undefined,
      shortName: convertForm.shortName.trim() || undefined,
      apcCode: convertForm.apcCode.trim() || undefined,
      city: convertForm.city.trim(),
      address: convertForm.address.trim() || undefined,
      adminName: convertForm.adminName.trim(),
      adminPhone: convertForm.adminPhone.trim(),
      adminEmail: convertForm.adminEmail.trim().toLowerCase() || undefined,
      sendInvite: convertForm.sendInvite,
      note: convertForm.note.trim() || undefined,
    };
    if (!payload.organizationName || !payload.city || !payload.adminName || !payload.adminPhone) {
      setConvertError('Completează numele organizației, orașul, numele și telefonul administratorului.');
      return;
    }
    if (payload.adminEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.adminEmail)) {
      setConvertError('E-mailul administratorului nu este valid.');
      return;
    }
    setConverting(true);
    try {
      const response = await accessRequestsApi.convertSuperadminAccessRequest(item.id, payload);
      const result = response.data || response;
      setConversionResult(result);
      if (result.request) {
        setItem(result.request);
        setInternalNote(result.request.internalNotes || '');
      } else {
        await load();
      }
      setSuccessMessage('Cererea a fost convertită. Onboarding inițial creat.');
      setConvertOpen(false);
    } catch (error: any) {
      setConvertError(String(error?.message || 'Nu am putut converti cererea.'));
    } finally {
      setConverting(false);
    }
  };
  return (
    <div className="space-y-5 pb-4">
      <div className="mx-auto max-w-5xl space-y-5">
        <Link href={localizedPath(basePath)} className="text-sm font-semibold text-foreground hover:underline">Înapoi la cereri</Link>
        <header className="rounded-2xl border border-border/70 bg-card p-5 shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h1 className="text-2xl font-semibold tracking-tight text-foreground">{item.associationName || item.legalName || 'Cerere acces'}</h1><p className="mt-1 text-sm text-muted-foreground">{item.fullName} · {item.phone} · {item.email || 'email necompletat'}</p></div>
            <Badge value={statusLabels[item.status] || item.status} tone={isConverted ? 'emerald' : item.status === 'NEW' ? 'amber' : 'slate'} />
          </div>
          {successMessage ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
              {successMessage}
              {conversionResult?.invitation?.inviteLink ? (
                <div className="mt-2">
                  <input className="h-10 w-full rounded-2xl border border-emerald-200 bg-white px-3 text-xs text-emerald-950" readOnly value={conversionResult.invitation.inviteLink} />
                </div>
              ) : null}
            </div>
          ) : null}
          {isConverted ? (
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
              <Badge value="Convertită" tone="emerald" />
              <span>Onboarding inițial creat</span>
              {convertedOrganizationId ? (
                <Link href={localizedPath(`/superadmin/organizations/${convertedOrganizationId}`)} className="font-semibold text-emerald-800 hover:underline">
                  Deschide organizația
                </Link>
              ) : null}
            </div>
          ) : null}
          {item.possibleDuplicate ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Posibil duplicat: există o cerere similară în ultimele 30 de zile pentru același contact și oraș/adresă.
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={() => updateStatus('CONTACTED')} className="rounded-2xl border border-border/70 px-3 py-2 text-sm font-semibold hover:bg-muted/60">Marchează contactat</button>
            <button onClick={() => updateStatus('ONBOARDING')} className="rounded-2xl border border-border/70 px-3 py-2 text-sm font-semibold hover:bg-muted/60">Mută în onboarding</button>
            <button onClick={() => updateStatus('REJECTED')} className="rounded-2xl border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50">Respinge</button>
            {isConverted ? (
              convertedOrganizationId ? <Link href={localizedPath(`/superadmin/organizations/${convertedOrganizationId}`)} className="rounded-2xl bg-foreground px-3 py-2 text-sm font-semibold text-background">Deschide organizația</Link> : null
            ) : (
              <button onClick={openConvertModal} className="rounded-2xl bg-foreground px-3 py-2 text-sm font-semibold text-background">Convertește în APC/client</button>
            )}
          </div>
        </header>
        <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-card">
          <h2 className="font-semibold text-foreground">Procesare CRM</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <select value={item.status} onChange={(event) => update({ status: event.target.value })} className="select">
              {statuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
            </select>
            <select value={item.priority} onChange={(event) => update({ priority: event.target.value })} className="select">
              {Object.keys(priorityLabels).map((priority) => <option key={priority} value={priority}>{priorityLabels[priority]}</option>)}
            </select>
            <button onClick={() => update({ status: 'CONTACTED', lastContactedAt: new Date().toISOString() })} className="h-10 rounded-2xl border border-border/70 px-3 text-sm font-semibold hover:bg-muted/60">Actualizează ultimul contact</button>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">Ultimul contact: {item.lastContactedAt ? new Date(item.lastContactedAt).toLocaleString('ro-MD') : '-'}</p>
        </section>
        <section className="grid gap-4 md:grid-cols-2">
          <Info title="Date contact" rows={[['Nume', item.fullName], ['Telefon', item.phone], ['E-mail', item.email || '-'], ['Oraș', item.city || '-'], ['Rol', item.contactRole || item.role || '-']]} />
          <Info title="Date APC/asociație" rows={[['Tip solicitant', typeLabels[item.type] || item.type || '-'], ['Asociație', item.associationName || '-'], ['Nume legal', item.legalName || '-'], ['Cod APC', item.apcCode || item.associationCode || '-'], ['Adresă', item.address || '-'], ['Blocuri', item.blocksCount || '-'], ['Apartamente', item.apartmentsCount || '-']]} />
        </section>
        <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-card">
          <h2 className="font-semibold text-foreground">Mesaj</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.message || 'Fără mesaj.'}</p>
          {item.possibleDuplicates?.length ? (
            <div className="mt-5">
              <h3 className="text-sm font-semibold text-foreground">Cereri similare</h3>
              <div className="mt-2 space-y-2">{item.possibleDuplicates.map((duplicate: any) => <Link key={duplicate.id} href={localizedPath(`${basePath}/${duplicate.id}`)} className="block rounded-2xl border border-border/70 p-3 text-sm text-foreground hover:border-amber-300">{duplicate.fullName} · {duplicate.phone} · {fmt(duplicate.createdAt)}</Link>)}</div>
            </div>
          ) : null}
        </section>
        <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-card">
          <h2 className="font-semibold text-foreground">Note interne</h2>
          <textarea value={internalNote} onChange={(e) => setInternalNote(e.target.value)} placeholder="Note interne pentru follow-up, calificare sau onboarding..." className="mt-3 min-h-36 w-full rounded-2xl border border-border/70 p-3 text-sm text-foreground outline-none focus:border-foreground/25 focus:ring-2 focus:ring-foreground/10" />
          <button onClick={() => update({ internalNote })} className="mt-3 rounded-2xl bg-foreground px-4 py-2 text-sm font-semibold text-background">Salvează note</button>
        </section>
        <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-foreground">Istoric</h2>
              <p className="mt-1 text-sm text-muted-foreground">Ultimele activități legate de această cerere.</p>
            </div>
            <Link href={localizedPath(`/superadmin/activity?accessRequestId=${item.id}`)} className="text-sm font-semibold text-foreground hover:underline">Vezi audit</Link>
          </div>
          {activity.length ? (
            <div className="mt-4 space-y-3">
              {activity.map((event: any) => (
                <div key={event.id} className="border-l-2 border-border pl-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{event.title || event.action}</p>
                    <Badge value={event.severity || 'INFO'} tone={event.severity === 'SUCCESS' ? 'emerald' : event.severity === 'WARNING' || event.severity === 'CRITICAL' ? 'amber' : 'slate'} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{event.message || event.description || '-'}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{event.actor?.fullName || 'Sistem'} · {event.createdAt ? new Date(event.createdAt).toLocaleString('ro-MD') : '-'}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-2xl border border-dashed border-border/70 p-4 text-sm text-muted-foreground">Nu există activități înregistrate pentru această cerere încă.</p>
          )}
        </section>
      </div>
      {convertOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="access-request-convert-title">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-lg bg-white p-5 shadow-xl sm:rounded-lg">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="access-request-convert-title" className="text-lg font-semibold text-slate-950">Convertește cererea în organizație</h2>
                <p className="mt-1 text-sm text-slate-500">Creează organizația, primul admin și statusul inițial de onboarding.</p>
              </div>
              <button type="button" onClick={() => setConvertOpen(false)} disabled={converting} className="rounded-md border border-slate-200 px-3 py-2 text-sm">Închide</button>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <ConvertField label="Nume organizație/APC" value={convertForm.organizationName} onChange={(value) => setConvertForm({ ...convertForm, organizationName: value })} required />
              <ConvertField label="Denumire juridică" value={convertForm.legalName} onChange={(value) => setConvertForm({ ...convertForm, legalName: value })} />
              <ConvertField label="Nume scurt" value={convertForm.shortName} onChange={(value) => setConvertForm({ ...convertForm, shortName: value })} />
              <ConvertField label="Cod APC" value={convertForm.apcCode} onChange={(value) => setConvertForm({ ...convertForm, apcCode: value })} />
              <ConvertField label="Oraș" value={convertForm.city} onChange={(value) => setConvertForm({ ...convertForm, city: value })} required />
              <ConvertField label="Adresă" value={convertForm.address} onChange={(value) => setConvertForm({ ...convertForm, address: value })} />
              <ConvertField label="Nume administrator" value={convertForm.adminName} onChange={(value) => setConvertForm({ ...convertForm, adminName: value })} required />
              <ConvertField label="Telefon administrator" value={convertForm.adminPhone} onChange={(value) => setConvertForm({ ...convertForm, adminPhone: value })} required />
              <ConvertField label="E-mail administrator" value={convertForm.adminEmail} onChange={(value) => setConvertForm({ ...convertForm, adminEmail: value })} type="email" />
              <label className="flex min-h-10 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700">
                <input type="checkbox" checked={convertForm.sendInvite} onChange={(event) => setConvertForm({ ...convertForm, sendInvite: event.target.checked })} />
                Trimite invitație
              </label>
              <label className="md:col-span-2">
                <span className="text-xs font-semibold uppercase text-slate-500">Notă internă</span>
                <textarea value={convertForm.note} onChange={(event) => setConvertForm({ ...convertForm, note: event.target.value })} className="mt-1 min-h-28 w-full rounded-md border border-slate-200 p-3 text-sm text-slate-800 outline-none focus:border-emerald-400" />
              </label>
            </div>
            {convertError ? (
              <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                {convertError}
              </p>
            ) : null}
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => setConvertOpen(false)} disabled={converting} className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60">Anulează</button>
              <button type="button" onClick={submitConversion} disabled={converting} className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                {converting ? 'Se convertește...' : 'Convertește în APC/client'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Info({ title, rows }: { title: string; rows: Array<[string, any]> }) {
  return <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-card"><h2 className="font-semibold text-foreground">{title}</h2><dl className="mt-4 space-y-3">{rows.map(([label, value]) => <div key={label} className="flex justify-between gap-4 text-sm"><dt className="text-muted-foreground">{label}</dt><dd className="text-right font-medium text-foreground">{value}</dd></div>)}</dl></section>;
}

function ConvertField({ label, value, onChange, required, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; type?: string }) {
  return (
    <label>
      <span className="text-xs font-semibold uppercase text-slate-500">{label}{required ? ' *' : ''}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-400" />
    </label>
  );
}
