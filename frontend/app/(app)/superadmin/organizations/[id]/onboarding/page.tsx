'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  CreditCard,
  FileText,
  Gauge,
  Hash,
  Home,
  ListChecks,
  Loader2,
  MapPin,
  Rocket,
  RotateCw,
  UserCog,
  Users,
} from 'lucide-react';
import { Badge, Card, Modal, ModalBody, ModalFooter, ModalHeader, PageHeader, StatCard } from '@/components/ui';
import { superadminApi } from '@/lib/api';
import { useLocalizedPath } from '@/lib/use-localized-path';

type ChecklistStatus = 'complete' | 'incomplete' | 'warning' | 'optional';
type SectionKey = 'BASIC_INFO' | 'ADMIN' | 'STRUCTURE' | 'APARTMENTS' | 'RESIDENTS' | 'METERS' | 'BILLING' | 'DOCUMENTS' | 'FINAL_REVIEW';

const statusLabels: Record<string, string> = {
  NOT_STARTED: 'Nepornit',
  IN_PROGRESS: 'În configurare',
  READY_FOR_LAUNCH: 'Gata de lansare',
  LAUNCHED: 'Lansat',
  BLOCKED: 'Blocat',
  COMPLETED: 'Completat',
};

const launchLabels: Record<string, string> = {
  DRAFT: 'Draft',
  INTERNAL_REVIEW: 'Revizuire internă',
  READY: 'Ready',
  LIVE: 'Live',
};

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('ro-RO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function statusVariant(status?: string): 'success' | 'warning' | 'error' | 'neutral' | 'default' {
  if (status === 'LAUNCHED' || status === 'COMPLETED' || status === 'LIVE') return 'success';
  if (status === 'READY_FOR_LAUNCH' || status === 'READY') return 'default';
  if (status === 'BLOCKED') return 'error';
  if (status === 'IN_PROGRESS' || status === 'INTERNAL_REVIEW') return 'warning';
  return 'neutral';
}

function sectionVariant(status: ChecklistStatus): 'success' | 'warning' | 'error' | 'neutral' {
  if (status === 'complete') return 'success';
  if (status === 'warning') return 'warning';
  if (status === 'optional') return 'neutral';
  return 'error';
}

function sectionStatusLabel(status: ChecklistStatus) {
  if (status === 'complete') return 'Complet';
  if (status === 'warning') return 'Atenție';
  if (status === 'optional') return 'Opțional';
  return 'Incomplet';
}

function iconForSection(key: SectionKey) {
  const className = 'h-5 w-5';
  const icons: Record<SectionKey, ReactNode> = {
    BASIC_INFO: <ListChecks className={className} />,
    ADMIN: <UserCog className={className} />,
    STRUCTURE: <Building2 className={className} />,
    APARTMENTS: <Home className={className} />,
    RESIDENTS: <Users className={className} />,
    METERS: <Gauge className={className} />,
    BILLING: <CreditCard className={className} />,
    DOCUMENTS: <FileText className={className} />,
    FINAL_REVIEW: <ClipboardCheck className={className} />,
  };
  return icons[key];
}

function actionHref(id: string, section: any) {
  const href = String(section?.action?.href || 'DETAIL');
  if (href === 'WIZARD') return `/superadmin/associations/new?id=${id}`;
  if (href === 'ADMIN_METERS') return '/admin/meters';
  if (href === 'ADMIN_BILLING') return `/superadmin/associations/new?id=${id}`;
  if (href === 'ADMIN_DOCUMENTS') return '/admin/documents';
  return `/superadmin/organizations/${id}`;
}

export default function OrganizationOnboardingWorkspacePage() {
  const params = useParams<{ id?: string }>();
  const localizedPath = useLocalizedPath();
  const id = typeof params?.id === 'string' ? params.id : '';
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [note, setNote] = useState('');
  const [launchModalOpen, setLaunchModalOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const res = await superadminApi.getOrganizationOnboarding(id);
      const next = res.data || res;
      setData(next);
      setNote(next.organization?.onboardingNote || '');
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut încărca onboarding-ul organizației.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const organization = data?.organization;
  const progress = data?.progress || { percent: 0, completedSteps: 0, totalSteps: 0 };
  const warnings = data?.warnings || [];
  const blockingErrors = data?.blockingErrors || [];
  const checklist = data?.checklist || [];
  const stats = data?.stats || {};

  const progressTone = useMemo<'success' | 'warning'>(() => {
    if (organization?.launchStatus === 'LIVE' || organization?.onboardingStatus === 'LAUNCHED') return 'success';
    if (blockingErrors.length) return 'warning';
    return 'success';
  }, [blockingErrors.length, organization?.launchStatus, organization?.onboardingStatus]);

  const updateOnboarding = async (payload: Record<string, unknown>, message: string) => {
    if (!id) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = await superadminApi.updateOrganizationOnboarding(id, payload as any);
      const next = res.data || res;
      setData(next);
      setNote(next.organization?.onboardingNote || '');
      setSuccess(message);
    } catch (err: any) {
      const details = err?.blockingErrors?.length ? ` ${err.blockingErrors.map((item: any) => item.message).join(' ')}` : '';
      setError(`${String(err?.message || 'Nu am putut actualiza onboarding-ul.')}${details}`);
    } finally {
      setSaving(false);
      setLaunchModalOpen(false);
    }
  };

  const recalculate = async () => {
    if (!id) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = await superadminApi.recalculateOrganizationOnboarding(id);
      const next = res.data || res;
      setData(next);
      setNote(next.organization?.onboardingNote || '');
      setSuccess('Checklist-ul a fost recalculat din datele reale.');
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut recalcula checklist-ul.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Card className="p-6 text-sm font-semibold text-muted-foreground">Se încarcă workspace-ul de onboarding...</Card>;
  }

  if (error && !data) {
    return (
      <div className="space-y-5 pb-4">
        <PageHeader
          title="Onboarding indisponibil"
          description="Nu putem încărca workspace-ul de onboarding pentru această organizație."
          rightSlot={<Link href={localizedPath(`/superadmin/organizations/${id}`)} className="rounded-2xl border border-border/70 px-4 py-2 text-sm font-semibold">Înapoi la organizație</Link>}
        />
        <Card className="p-5 text-sm font-semibold text-rose-700">{error}</Card>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        title={organization?.name || 'Onboarding organizație'}
        description={[organization?.city, organization?.associationCode || organization?.fiscalCode].filter(Boolean).join(' · ') || 'Workspace intern Superadmin'}
        rightSlot={
          <div className="flex flex-wrap gap-2">
            <Link href={localizedPath(`/superadmin/organizations/${id}`)} className="rounded-2xl border border-border/70 px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted/60">
              Înapoi la organizație
            </Link>
            <button type="button" onClick={recalculate} disabled={saving} className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-border/70 px-4 text-sm font-semibold text-foreground hover:bg-muted/60 disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
              Recalculează
            </button>
          </div>
        }
      />

      {error ? <Card className="border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">{error}</Card> : null}
      {success ? <Card className="border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{success}</Card> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard label="Progres" value={`${progress.percent}%`} description={`${progress.completedSteps}/${progress.totalSteps} pași`} icon={<ClipboardCheck className="h-5 w-5" />} tone={progressTone} />
        <StatCard label="Blocuri" value={stats.blocksCount || 0} description="Structură" icon={<Building2 className="h-5 w-5" />} />
        <StatCard label="Scări" value={stats.entrancesCount || 0} description="Intrări" icon={<Building2 className="h-5 w-5" />} />
        <StatCard label="Apartamente" value={stats.apartmentsCount || 0} description="Unități" icon={<Home className="h-5 w-5" />} />
        <StatCard label="Locatari" value={stats.residentsCount || 0} description="Profiluri" icon={<Users className="h-5 w-5" />} />
        <StatCard label="Documente" value={stats.documentsCount || 0} description="Încărcate" icon={<FileText className="h-5 w-5" />} />
      </section>

      <Card>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap gap-2">
              <Badge variant={statusVariant(organization?.onboardingStatus)}>{statusLabels[organization?.onboardingStatus] || organization?.onboardingStatus}</Badge>
              <Badge variant={statusVariant(organization?.launchStatus)}>{launchLabels[organization?.launchStatus] || organization?.launchStatus}</Badge>
            </div>
            <h2 className="mt-3 text-lg font-semibold text-foreground">Pregătire lansare</h2>
            <p className="mt-1 text-sm text-muted-foreground">Checklist calculat din date reale pentru activarea organizației în platformă.</p>
            <div className="mt-4 h-2 w-full max-w-xl overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, Math.max(0, progress.percent || 0))}%` }} />
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[420px]">
            <Meta icon={<MapPin className="h-4 w-4" />} label="Oraș" value={organization?.city || '-'} />
            <Meta icon={<Hash className="h-4 w-4" />} label="Cod APC" value={organization?.associationCode || 'Lipsește'} />
          </div>
        </div>
      </Card>

      <section className="grid gap-4 xl:grid-cols-[1fr_0.65fr]">
        <div className="grid gap-3 md:grid-cols-2">
          {checklist.map((section: any) => (
            <Card key={section.key} className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border/70 bg-muted/40 text-foreground">
                    {iconForSection(section.key)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{section.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{section.description}</p>
                  </div>
                </div>
                <Badge variant={sectionVariant(section.status)}>{sectionStatusLabel(section.status)}</Badge>
              </div>
              <div className="space-y-2">
                {(section.items || []).map((item: any) => (
                  <div key={item.key} className="flex items-center gap-2 text-sm">
                    {item.completed ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                    <span className={item.completed ? 'text-foreground' : 'text-muted-foreground'}>{item.label}</span>
                  </div>
                ))}
              </div>
              <Link href={localizedPath(actionHref(id, section))} className="mt-auto inline-flex min-h-10 items-center justify-center rounded-2xl border border-border/70 px-4 text-sm font-semibold text-foreground hover:bg-muted/60">
                {section.action?.label || 'Deschide'}
              </Link>
            </Card>
          ))}
        </div>

        <div className="space-y-4">
          <Card>
            <h2 className="text-base font-semibold text-foreground">Probleme de rezolvat</h2>
            <div className="mt-4 space-y-2">
              {blockingErrors.map((issue: any) => (
                <IssueRow key={`${issue.code}-blocking`} issue={issue} />
              ))}
              {warnings.map((issue: any) => (
                <IssueRow key={`${issue.code}-warning`} issue={issue} />
              ))}
              {!blockingErrors.length && !warnings.length ? (
                <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
                  Nu există probleme critice. Organizația poate fi pregătită pentru lansare.
                </p>
              ) : null}
            </div>
          </Card>

          <Card>
            <h2 className="text-base font-semibold text-foreground">Date client</h2>
            {data?.sourceAccessRequest ? (
              <div className="mt-4 space-y-3 text-sm">
                <Line label="Contact inițial" value={data.sourceAccessRequest.contactName || '-'} />
                <Line label="Telefon" value={data.sourceAccessRequest.phone || '-'} />
                <Line label="Email" value={data.sourceAccessRequest.email || '-'} />
                <Line label="Data cererii" value={formatDate(data.sourceAccessRequest.requestedAt)} />
                <Link href={localizedPath(`/superadmin/access-requests/${data.sourceAccessRequest.id}`)} className="inline-flex min-h-10 items-center justify-center rounded-2xl border border-border/70 px-4 text-sm font-semibold text-foreground hover:bg-muted/60">
                  Deschide cererea inițială
                </Link>
              </div>
            ) : (
              <p className="mt-4 rounded-2xl border border-border/70 bg-muted/25 p-4 text-sm text-muted-foreground">
                Organizația nu are o cerere de acces legată.
              </p>
            )}
          </Card>

          <Card>
            <h2 className="text-base font-semibold text-foreground">Predare către Admin</h2>
            <div className="mt-4 space-y-3 text-sm">
              <Line label="Status" value={handoverLabel(data?.adminHandover?.status)} />
              <Line label="Invitație" value={data?.adminHandover?.invitedAt ? formatDate(data.adminHandover.invitedAt) : 'Netrimisă'} />
              <Line label="Acceptată" value={data?.adminHandover?.acceptedAt ? formatDate(data.adminHandover.acceptedAt) : '-'} />
              <Line label="First login" value={data?.adminHandover?.firstLoginAt ? formatDate(data.adminHandover.firstLoginAt) : '-'} />
              <Link href={localizedPath(`/superadmin/organizations/${id}?tab=handover`)} className="inline-flex min-h-10 items-center justify-center rounded-2xl border border-border/70 px-4 text-sm font-semibold text-foreground hover:bg-muted/60">
                Deschide Admin handover
              </Link>
            </div>
          </Card>

          <Card>
            <h2 className="text-base font-semibold text-foreground">Acțiuni Superadmin</h2>
            <div className="mt-4 grid gap-2">
              <ActionButton disabled={saving} onClick={() => updateOnboarding({ onboardingStatus: 'IN_PROGRESS', launchStatus: 'INTERNAL_REVIEW' }, 'Organizația este marcată în configurare.')}>
                Marchează ca în configurare
              </ActionButton>
              <ActionButton disabled={saving} onClick={() => updateOnboarding({ onboardingStatus: 'READY_FOR_LAUNCH', launchStatus: 'READY' }, 'Organizația este marcată gata de lansare.')}>
                Marchează gata de lansare
              </ActionButton>
              <ActionButton disabled={saving} onClick={() => updateOnboarding({ onboardingStatus: 'BLOCKED', launchStatus: 'INTERNAL_REVIEW' }, 'Organizația este marcată ca blocată.')}>
                Marchează blocat
              </ActionButton>
              <button type="button" onClick={() => setLaunchModalOpen(true)} disabled={saving} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-60">
                <Rocket className="h-4 w-4" />
                Lansează organizația
              </button>
            </div>
          </Card>

          <Card>
            <h2 className="text-base font-semibold text-foreground">Notă onboarding</h2>
            <textarea value={note} onChange={(event) => setNote(event.target.value)} className="mt-3 min-h-[120px] w-full rounded-2xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-foreground" />
            <button type="button" disabled={saving} onClick={() => updateOnboarding({ onboardingNote: note }, 'Nota de onboarding a fost salvată.')} className="mt-3 min-h-10 rounded-2xl bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-60">
              Salvează nota
            </button>
          </Card>
        </div>
      </section>

      <Modal isOpen={launchModalOpen} onClose={() => setLaunchModalOpen(false)} maxWidth="xl">
        <ModalHeader title="Lansează organizația" onClose={() => setLaunchModalOpen(false)} />
        <ModalBody>
          {blockingErrors.length ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
              <p className="font-semibold text-rose-900">Organizația nu poate fi lansată încă.</p>
              <div className="mt-3 space-y-2">
                {blockingErrors.map((issue: any) => <IssueRow key={issue.code} issue={issue} />)}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Confirmă lansarea. Organizația va deveni activă și onboarding-ul va fi marcat ca lansat.</p>
              {warnings.length ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="font-semibold text-amber-900">Există atenționări non-critice.</p>
                  <div className="mt-3 space-y-2">
                    {warnings.map((issue: any) => <IssueRow key={issue.code} issue={issue} />)}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <button type="button" onClick={() => setLaunchModalOpen(false)} className="rounded-2xl border border-border/70 px-4 py-2 text-sm font-semibold">
            Anulează
          </button>
          <button
            type="button"
            onClick={() => updateOnboarding({ onboardingStatus: 'LAUNCHED', launchStatus: 'LIVE' }, 'Organizația a fost lansată.')}
            disabled={saving || blockingErrors.length > 0}
            className="rounded-2xl bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-60"
          >
            Confirmă lansarea
          </button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

function handoverLabel(status?: string) {
  const labels: Record<string, string> = {
    NOT_STARTED: 'Invitație netrimisă',
    INVITED: 'Invitație trimisă',
    ACCEPTED: 'Acceptată',
    FIRST_LOGIN_DONE: 'First login finalizat',
    ACTIVE: 'Activ',
  };
  return status ? labels[status] || status : 'Invitație netrimisă';
}

function Meta({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-muted/25 p-3">
      <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</p>
      <p className="mt-2 font-medium text-foreground">{value}</p>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  );
}

function IssueRow({ issue }: { issue: any }) {
  const blocking = !!issue.blocking;
  return (
    <div className={`flex gap-2 rounded-2xl border p-3 text-sm ${blocking ? 'border-rose-200 bg-rose-50 text-rose-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{issue.message}</span>
    </div>
  );
}

function ActionButton({ children, disabled, onClick }: { children: ReactNode; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="min-h-10 rounded-2xl border border-border/70 px-4 text-sm font-semibold text-foreground hover:bg-muted/60 disabled:opacity-60">
      {children}
    </button>
  );
}
