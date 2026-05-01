'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import MobilePageHeader from '@/components/common/MobilePageHeader';
import LoadingState from '@/components/common/LoadingState';
import EmptyState from '@/components/common/EmptyState';
import StatusBadge from '@/components/ui/StatusBadge';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/ToastProvider';
import { superadminApi } from '@/lib/api';

type CheckStatus = 'NOT_CHECKED' | 'PASSED' | 'FAILED';
type LaunchStatus = 'NOT_READY' | 'READY_FOR_BETA' | 'LIVE';

type BetaCheck = {
  id: string;
  key: string;
  title: string;
  status: CheckStatus;
  notes: string | null;
  isCritical: boolean;
  lastCheckedAt: string | null;
  checkedByUser?: { id: string; email: string } | null;
};

export default function SuperadminBetaReadinessPage() {
  const { showToast } = useToast();
  const [checks, setChecks] = useState<BetaCheck[]>([]);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [launchStatus, setLaunchStatus] = useState<LaunchStatus>('NOT_READY');
  const [allCriticalPassed, setAllCriticalPassed] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [progress, setProgress] = useState(0);
  const [orgCounts, setOrgCounts] = useState({ demo: 0, real: 0 });
  const [warning, setWarning] = useState('Beta version — verify data before official use.');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await superadminApi.betaReadiness();
      const payload = res.data;
      setChecks(payload.checks || []);
      setNotesDraft(
        (payload.checks || []).reduce<Record<string, string>>((acc, item) => {
          acc[item.id] = item.notes || '';
          return acc;
        }, {}),
      );
      setLaunchStatus(payload.launchStatus || 'NOT_READY');
      setMaintenanceMode(!!payload.maintenanceMode);
      setAllCriticalPassed(!!payload.allCriticalPassed);
      setProgress(payload.progress || 0);
      setOrgCounts(payload.organizations || { demo: 0, real: 0 });
      setWarning(payload.betaWarning || 'Beta version — verify data before official use.');
    } catch {
      showToast('Eroare la încărcarea beta readiness', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const criticalCount = useMemo(() => checks.filter((item) => item.isCritical).length, [checks]);
  const criticalPassed = useMemo(
    () => checks.filter((item) => item.isCritical && item.status === 'PASSED').length,
    [checks],
  );

  const saveCheck = async (id: string, status: CheckStatus) => {
    setSavingId(id);
    try {
      const res = await superadminApi.updateBetaReadinessCheck(id, {
        status,
        notes: (notesDraft[id] || '').trim(),
      });
      const updated = res.data as BetaCheck;
      setChecks((prev) => prev.map((item) => (item.id === id ? updated : item)));
      setNotesDraft((prev) => ({ ...prev, [id]: updated.notes || '' }));
      await load();
      showToast('Salvat cu succes');
    } catch (error: any) {
      showToast(error?.message || 'Eroare la salvare', 'error');
    } finally {
      setSavingId(null);
    }
  };

  const changeLaunchStatus = async (status: LaunchStatus) => {
    try {
      await superadminApi.updateBetaLaunchStatus(status);
      setLaunchStatus(status);
      await load();
      showToast('Salvat cu succes');
    } catch (error: any) {
      showToast(error?.message || 'Eroare la actualizarea statusului', 'error');
    }
  };

  const toggleMaintenanceMode = async () => {
    try {
      await superadminApi.updateMaintenanceMode(!maintenanceMode);
      await load();
      showToast('Salvat cu succes');
    } catch (error: any) {
      showToast(error?.message || 'Eroare la actualizarea mentenantei', 'error');
    }
  };

  return (
    <div className="space-y-4">
      <MobilePageHeader
        title="Beta Readiness"
        subtitle="Final pre-launch checklist pentru primele organizații reale."
      />

      <div className="rounded-xl border border-amber-500/40 bg-amber-50 p-3 text-sm text-amber-900">
        <p className="font-medium">Beta version — verify data before official use.</p>
        <p className="mt-1">{warning}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-border/70 bg-card p-4">
          <p className="text-xs text-muted-foreground">Progress</p>
          <p className="text-xl font-semibold text-foreground">{progress}%</p>
        </div>
        <div className="rounded-xl border border-border/70 bg-card p-4">
          <p className="text-xs text-muted-foreground">Critical checks</p>
          <p className="text-xl font-semibold text-foreground">
            {criticalPassed}/{criticalCount}
          </p>
        </div>
        <div className="rounded-xl border border-border/70 bg-card p-4">
          <p className="text-xs text-muted-foreground">Organizations split</p>
          <p className="text-sm text-foreground">Real: {orgCounts.real} • Demo: {orgCounts.demo}</p>
        </div>
      </div>

      <div className="rounded-xl border border-border/70 bg-card p-4">
        <p className="text-sm font-medium text-foreground">Final launch status</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusBadge status={launchStatus} />
          <Button size="sm" variant="outline" onClick={() => changeLaunchStatus('NOT_READY')}>
            Set NOT_READY
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={!allCriticalPassed}
            onClick={() => changeLaunchStatus('READY_FOR_BETA')}
          >
            Set READY_FOR_BETA
          </Button>
          <Button size="sm" onClick={() => changeLaunchStatus('LIVE')}>
            Set LIVE
          </Button>
        </div>
        {!allCriticalPassed ? (
          <p className="mt-2 text-xs text-muted-foreground">
            READY_FOR_BETA este permis doar când toate check-urile critice sunt PASSED.
          </p>
        ) : null}
      </div>

      <div className="rounded-xl border border-border/70 bg-card p-4">
        <p className="text-sm font-medium text-foreground">Maintenance mode</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Cind este activ, doar SUPER_ADMIN poate folosi aplicatia.
        </p>
        <div className="mt-2 flex items-center gap-2">
          <StatusBadge status={maintenanceMode ? 'WARNING' : 'SUCCESS'} />
          <Button size="sm" variant={maintenanceMode ? 'danger' : 'secondary'} onClick={toggleMaintenanceMode}>
            {maintenanceMode ? 'Disable maintenance' : 'Enable maintenance'}
          </Button>
        </div>
      </div>

      {loading ? <LoadingState label="Se încarcă beta checklist..." rows={6} /> : null}
      {!loading && !checks.length ? (
        <EmptyState title="Nu există date încă" description="Checklist-ul beta nu este disponibil." />
      ) : null}

      {!loading && checks.length ? (
        <div className="space-y-3">
          {checks.map((item) => (
            <div key={item.id} className="rounded-xl border border-border/70 bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">
                  {item.title} {item.isCritical ? <span className="text-xs text-destructive">(critical)</span> : null}
                </p>
                <StatusBadge status={item.status} />
              </div>
              <textarea
                className="mt-2 min-h-[80px] w-full rounded-md border border-border bg-background p-2 text-sm"
                placeholder="Notes"
                value={notesDraft[item.id] ?? ''}
                onChange={(e) => setNotesDraft((prev) => ({ ...prev, [item.id]: e.target.value }))}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" isLoading={savingId === item.id} onClick={() => saveCheck(item.id, 'PASSED')}>
                  Mark PASSED
                </Button>
                <Button size="sm" variant="danger" isLoading={savingId === item.id} onClick={() => saveCheck(item.id, 'FAILED')}>
                  Mark FAILED
                </Button>
                <Button size="sm" variant="outline" isLoading={savingId === item.id} onClick={() => saveCheck(item.id, 'NOT_CHECKED')}>
                  Reset
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
