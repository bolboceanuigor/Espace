'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  FileSignature,
  ListChecks,
  Plus,
  RefreshCw,
  Search,
  XCircle,
} from 'lucide-react';
import { Badge, Card, Modal, ModalBody, ModalFooter, ModalHeader, PageHeader, StatCard } from '@/components/ui';
import { superadminApi, superadminRevenueApi } from '@/lib/api';
import { useLocalizedPath } from '@/lib/use-localized-path';

type BillingTaskFilters = {
  search: string;
  status: string;
  type: string;
  priority: string;
  organizationId: string;
  dueFrom: string;
  dueTo: string;
};

const emptyFilters: BillingTaskFilters = {
  search: '',
  status: '',
  type: '',
  priority: '',
  organizationId: '',
  dueFrom: '',
  dueTo: '',
};

const emptyTaskForm = {
  organizationId: '',
  title: '',
  description: '',
  type: 'OTHER',
  priority: 'NORMAL',
  dueDate: '',
  internalNote: '',
};

const statuses = ['', 'OPEN', 'IN_PROGRESS', 'DONE', 'DISMISSED'];
const priorities = ['', 'LOW', 'NORMAL', 'HIGH', 'URGENT'];
const taskTypes = [
  '',
  'CREATE_CONTRACT',
  'SIGN_CONTRACT',
  'ACTIVATE_SUBSCRIPTION',
  'CHECK_PAYMENT',
  'PAYMENT_FOLLOW_UP',
  'CONTRACT_EXPIRING',
  'CONTRACT_EXPIRED',
  'SUBSCRIPTION_INACTIVE',
  'TRIAL_ENDING',
  'PRICING_MISSING',
  'LIVE_WITHOUT_CONTRACT',
  'OTHER',
];

const statusLabels: Record<string, string> = {
  OPEN: 'Deschis',
  IN_PROGRESS: 'În lucru',
  DONE: 'Finalizat',
  DISMISSED: 'Respins',
};

const priorityLabels: Record<string, string> = {
  LOW: 'Low',
  NORMAL: 'Normal',
  HIGH: 'High',
  URGENT: 'Urgent',
};

const typeLabels: Record<string, string> = {
  CREATE_CONTRACT: 'Creează contract',
  SIGN_CONTRACT: 'Semnează contract',
  ACTIVATE_SUBSCRIPTION: 'Activează abonament',
  CHECK_PAYMENT: 'Verifică plata',
  PAYMENT_FOLLOW_UP: 'Follow-up plată',
  CONTRACT_EXPIRING: 'Contract expiră',
  CONTRACT_EXPIRED: 'Contract expirat',
  SUBSCRIPTION_INACTIVE: 'Abonament inactiv',
  TRIAL_ENDING: 'Trial se termină',
  PRICING_MISSING: 'Tarif lipsă',
  LIVE_WITHOUT_CONTRACT: 'Live fără contract',
  OTHER: 'Altceva',
};

const actionLinkClass = 'inline-flex min-h-9 items-center rounded-xl border border-border/70 px-3 font-semibold text-foreground hover:bg-muted/60';

export default function SuperadminBillingTasksPage() {
  const localizedPath = useLocalizedPath();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<BillingTaskFilters>(() => ({
    ...emptyFilters,
    organizationId: searchParams.get('organizationId') || '',
  }));
  const [page, setPage] = useState(1);
  const [data, setData] = useState<any>({ items: [], summary: {}, total: 0, page: 1, totalPages: 1 });
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [taskForm, setTaskForm] = useState(emptyTaskForm);
  const [formError, setFormError] = useState('');

  const query = useMemo(() => ({
    search: filters.search || undefined,
    status: filters.status || undefined,
    type: filters.type || undefined,
    priority: filters.priority || undefined,
    organizationId: filters.organizationId || undefined,
    dueFrom: filters.dueFrom || undefined,
    dueTo: filters.dueTo || undefined,
    page,
    limit: 20,
  }), [filters, page]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [tasksRes, organizationsRes] = await Promise.all([
        superadminApi.getSuperadminBillingTasks(query),
        superadminRevenueApi.getSuperadminRevenueOrganizations({ limit: 100 }),
      ]);
      setData(tasksRes.data || { items: [], summary: {}, total: 0, page: 1, totalPages: 1 });
      setOrganizations(organizationsRes.data?.items || []);
    } catch (loadError: any) {
      setError(String(loadError?.message || 'Nu am putut încărca taskurile de facturare.'));
      setData({ items: [], summary: {}, total: 0, page: 1, totalPages: 1 });
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const generateTasks = async () => {
    setGenerating(true);
    setMessage('');
    setError('');
    try {
      const res = await superadminApi.generateSuperadminBillingTasks();
      setMessage(res.data?.message || `Au fost generate ${res.data?.created || 0} taskuri noi. ${res.data?.kept || 0} taskuri existente au fost păstrate.`);
      await load();
    } catch (generateError: any) {
      setError(String(generateError?.message || 'Nu am putut genera taskurile.'));
    } finally {
      setGenerating(false);
    }
  };

  const createTask = async () => {
    setFormError('');
    setMessage('');
    if (!taskForm.title.trim()) {
      setFormError('Titlul este obligatoriu.');
      return;
    }
    setSaving(true);
    try {
      await superadminApi.createSuperadminBillingTask({
        organizationId: taskForm.organizationId || null,
        title: taskForm.title.trim(),
        description: taskForm.description.trim() || null,
        type: taskForm.type,
        priority: taskForm.priority,
        dueDate: taskForm.dueDate || null,
        internalNote: taskForm.internalNote.trim() || null,
      });
      setTaskForm(emptyTaskForm);
      setCreateModalOpen(false);
      setMessage('Taskul a fost creat.');
      await load();
    } catch (createError: any) {
      setFormError(String(createError?.message || 'Nu am putut crea taskul.'));
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (task: any, status: string) => {
    setMessage('');
    setError('');
    try {
      await superadminApi.updateSuperadminBillingTask(task.id, { status });
      setMessage('Statusul taskului a fost actualizat.');
      await load();
      if (selectedTask?.id === task.id) setSelectedTask({ ...selectedTask, status });
    } catch (updateError: any) {
      setError(String(updateError?.message || 'Nu am putut actualiza taskul.'));
    }
  };

  const completeTask = async (task: any) => {
    setMessage('');
    setError('');
    try {
      await superadminApi.completeSuperadminBillingTask(task.id);
      setMessage('Taskul a fost finalizat.');
      setSelectedTask(null);
      setTaskModalOpen(false);
      await load();
    } catch (completeError: any) {
      setError(String(completeError?.message || 'Nu am putut finaliza taskul.'));
    }
  };

  const dismissTask = async (task: any) => {
    setMessage('');
    setError('');
    try {
      await superadminApi.dismissSuperadminBillingTask(task.id);
      setMessage('Taskul a fost respins.');
      setSelectedTask(null);
      setTaskModalOpen(false);
      await load();
    } catch (dismissError: any) {
      setError(String(dismissError?.message || 'Nu am putut respinge taskul.'));
    }
  };

  const summary = data.summary || {};

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        title="Taskuri facturare"
        description="Urmărește contractele, abonamentele, scadențele și follow-up-ul comercial."
        badge={<Badge variant="neutral">Superadmin</Badge>}
        rightSlot={
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={generateTasks} disabled={generating} className="inline-flex min-h-10 items-center gap-2 rounded-2xl bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-60">
              <ListChecks className="h-4 w-4" />
              {generating ? 'Se generează...' : 'Generează taskuri'}
            </button>
            <button type="button" onClick={() => { setTaskForm(emptyTaskForm); setFormError(''); setCreateModalOpen(true); }} className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-border/70 px-4 text-sm font-semibold text-foreground hover:bg-muted/60">
              <Plus className="h-4 w-4" />
              Task nou
            </button>
            <button type="button" onClick={load} disabled={loading} className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-border/70 px-4 text-sm font-semibold text-foreground hover:bg-muted/60 disabled:opacity-60">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        }
      />

      {message ? <Notice tone="success">{message}</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard label="Taskuri deschise" value={summary.open || 0} icon={<ClipboardCheck className="h-5 w-5" />} tone="neutral" />
        <StatCard label="Urgente" value={summary.urgent || 0} icon={<AlertTriangle className="h-5 w-5" />} tone="danger" />
        <StatCard label="În lucru" value={summary.inProgress || 0} icon={<RefreshCw className="h-5 w-5" />} tone="warning" />
        <StatCard label="Scadente azi" value={summary.dueToday || 0} icon={<CalendarClock className="h-5 w-5" />} tone="warning" />
        <StatCard label="Scadente în 7 zile" value={summary.dueNext7Days || 0} icon={<CalendarClock className="h-5 w-5" />} tone="neutral" />
        <StatCard label="Finalizate luna aceasta" value={summary.completedThisMonth || 0} icon={<CheckCircle2 className="h-5 w-5" />} tone="success" />
      </div>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Taskuri</h2>
            <p className="mt-1 text-sm text-muted-foreground">Lista operațională pentru contracte, abonamente și follow-up comercial.</p>
          </div>
          <button type="button" onClick={() => { setFilters(emptyFilters); setPage(1); }} className="min-h-10 rounded-2xl border border-border/70 px-4 text-sm font-semibold hover:bg-muted/60">
            Resetează filtre
          </button>
        </div>

        <Filters filters={filters} organizations={organizations} onChange={(next) => { setFilters(next); setPage(1); }} />

        <BillingTasksTable
          items={data.items || []}
          localizedPath={localizedPath}
          onOpen={(task) => { setSelectedTask(task); setTaskModalOpen(true); }}
          onProgress={(task) => updateStatus(task, 'IN_PROGRESS')}
          onComplete={completeTask}
          onDismiss={dismissTask}
        />

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>{data.total || 0} taskuri</span>
          <div className="flex items-center gap-2">
            <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))} className="min-h-9 rounded-xl border border-border/70 px-3 font-semibold disabled:opacity-50">
              Anterior
            </button>
            <span>Pagina {data.page || page} / {data.totalPages || 1}</span>
            <button type="button" disabled={page >= (data.totalPages || 1) || loading} onClick={() => setPage((current) => current + 1)} className="min-h-9 rounded-xl border border-border/70 px-3 font-semibold disabled:opacity-50">
              Următor
            </button>
          </div>
        </div>
      </Card>

      <TaskDetailModal
        task={selectedTask}
        open={taskModalOpen}
        localizedPath={localizedPath}
        onClose={() => setTaskModalOpen(false)}
        onProgress={(task) => updateStatus(task, 'IN_PROGRESS')}
        onComplete={completeTask}
        onDismiss={dismissTask}
      />

      <Modal isOpen={createModalOpen} onClose={() => setCreateModalOpen(false)} maxWidth="2xl">
        <ModalHeader title="Task nou" onClose={() => setCreateModalOpen(false)} />
        <ModalBody>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block md:col-span-2">
              <span className="label">Organizație</span>
              <select className="select" value={taskForm.organizationId} onChange={(event) => setTaskForm({ ...taskForm, organizationId: event.target.value })}>
                <option value="">Fără organizație</option>
                {organizations.map((organization) => (
                  <option key={organization.organizationId} value={organization.organizationId}>{organization.organizationName}</option>
                ))}
              </select>
            </label>
            <Field label="Titlu" value={taskForm.title} onChange={(value) => setTaskForm({ ...taskForm, title: value })} required />
            <SelectField label="Tip" value={taskForm.type} options={taskTypes.filter(Boolean)} labels={typeLabels} onChange={(value) => setTaskForm({ ...taskForm, type: value })} />
            <SelectField label="Prioritate" value={taskForm.priority} options={priorities.filter(Boolean)} labels={priorityLabels} onChange={(value) => setTaskForm({ ...taskForm, priority: value })} />
            <Field label="Scadență" type="date" value={taskForm.dueDate} onChange={(value) => setTaskForm({ ...taskForm, dueDate: value })} />
            <label className="block md:col-span-2">
              <span className="label">Descriere</span>
              <textarea className="min-h-[100px] w-full rounded-2xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-foreground" value={taskForm.description} onChange={(event) => setTaskForm({ ...taskForm, description: event.target.value })} />
            </label>
            <label className="block md:col-span-2">
              <span className="label">Notă internă</span>
              <textarea className="min-h-[100px] w-full rounded-2xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-foreground" value={taskForm.internalNote} onChange={(event) => setTaskForm({ ...taskForm, internalNote: event.target.value })} />
            </label>
          </div>
          {formError ? <Notice tone="error" className="mt-4">{formError}</Notice> : null}
        </ModalBody>
        <ModalFooter>
          <button type="button" onClick={() => setCreateModalOpen(false)} disabled={saving} className="rounded-2xl border border-border/70 px-4 py-2 text-sm font-semibold disabled:opacity-60">Anulează</button>
          <button type="button" onClick={createTask} disabled={saving} className="rounded-2xl bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-60">
            {saving ? 'Se salvează...' : 'Creează task'}
          </button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

function Filters({ filters, organizations, onChange }: { filters: BillingTaskFilters; organizations: any[]; onChange: (filters: BillingTaskFilters) => void }) {
  return (
    <div className="my-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[1.2fr_0.9fr_0.9fr_0.9fr_1fr_0.8fr_0.8fr]">
      <label className="block">
        <span className="label">Search</span>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input className="input pl-9" value={filters.search} onChange={(event) => onChange({ ...filters, search: event.target.value })} placeholder="Task, organizație, cod APC" />
        </div>
      </label>
      <SelectField label="Status" value={filters.status} options={statuses} labels={statusLabels} onChange={(value) => onChange({ ...filters, status: value })} allLabel="Toate" />
      <SelectField label="Tip" value={filters.type} options={taskTypes} labels={typeLabels} onChange={(value) => onChange({ ...filters, type: value })} allLabel="Toate" />
      <SelectField label="Prioritate" value={filters.priority} options={priorities} labels={priorityLabels} onChange={(value) => onChange({ ...filters, priority: value })} allLabel="Toate" />
      <label className="block">
        <span className="label">Organizație</span>
        <select className="select" value={filters.organizationId} onChange={(event) => onChange({ ...filters, organizationId: event.target.value })}>
          <option value="">Toate</option>
          {organizations.map((organization) => (
            <option key={organization.organizationId} value={organization.organizationId}>{organization.organizationName}</option>
          ))}
        </select>
      </label>
      <Field label="Due from" type="date" value={filters.dueFrom} onChange={(value) => onChange({ ...filters, dueFrom: value })} />
      <Field label="Due to" type="date" value={filters.dueTo} onChange={(value) => onChange({ ...filters, dueTo: value })} />
    </div>
  );
}

function BillingTasksTable({
  items,
  localizedPath,
  onOpen,
  onProgress,
  onComplete,
  onDismiss,
}: {
  items: any[];
  localizedPath: (path: string) => string;
  onOpen: (task: any) => void;
  onProgress: (task: any) => void;
  onComplete: (task: any) => void;
  onDismiss: (task: any) => void;
}) {
  if (!items.length) {
    return (
      <p className="rounded-lg border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">
        Nu există taskuri de facturare. Apasă Generează taskuri pentru a crea taskuri pe baza contractelor și abonamentelor existente.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1180px] text-left text-sm">
        <thead className="border-b border-border/70 text-xs uppercase text-muted-foreground">
          <tr>
            {['Task', 'Organizație', 'Tip', 'Prioritate', 'Status', 'Scadență', 'Contract status', 'Subscription status', 'Acțiuni'].map((header) => (
              <th key={header} className="px-3 py-3 font-semibold">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {items.map((task) => (
            <tr key={task.id} className="align-top">
              <td className="px-3 py-4">
                <button type="button" onClick={() => onOpen(task)} className="text-left font-semibold text-foreground hover:underline">{task.title}</button>
                <p className="mt-1 text-xs text-muted-foreground">{task.source === 'AUTO' ? 'Generat automat' : 'Manual'}</p>
              </td>
              <td className="px-3 py-4">
                {task.organization ? (
                  <Link href={localizedPath(`/superadmin/organizations/${task.organization.id}`)} className="font-medium text-foreground hover:underline">{task.organization.name}</Link>
                ) : '-'}
                <p className="text-xs text-muted-foreground">{task.organization?.city || ''}</p>
              </td>
              <td className="px-3 py-4"><Badge variant="neutral">{typeLabels[task.type] || task.type}</Badge></td>
              <td className="px-3 py-4"><Badge variant={priorityTone(task.priority)}>{priorityLabels[task.priority] || task.priority}</Badge></td>
              <td className="px-3 py-4"><Badge variant={statusTone(task.status)}>{statusLabels[task.status] || task.status}</Badge></td>
              <td className="px-3 py-4 text-muted-foreground">{date(task.dueDate)}</td>
              <td className="px-3 py-4">{task.contract?.status ? <Badge variant={contractTone(task.contract.status)}>{task.contract.status}</Badge> : '-'}</td>
              <td className="px-3 py-4">{task.subscription?.status ? <Badge variant={subscriptionTone(task.subscription.status)}>{task.subscription.status}</Badge> : '-'}</td>
              <td className="px-3 py-4">
                <div className="flex flex-wrap gap-2">
                  {task.organization ? <Link href={localizedPath(`/superadmin/organizations/${task.organization.id}`)} className={actionLinkClass}>Organizație</Link> : null}
                  {task.organization ? <Link href={localizedPath(`/superadmin/organizations/${task.organization.id}?tab=contract`)} className={actionLinkClass}>Contract</Link> : null}
                  {task.status === 'OPEN' ? <button type="button" onClick={() => onProgress(task)} className={actionLinkClass}>În lucru</button> : null}
                  {task.status !== 'DONE' ? <button type="button" onClick={() => onComplete(task)} className={`${actionLinkClass} text-emerald-700`}>Finalizează</button> : null}
                  {task.status !== 'DISMISSED' ? <button type="button" onClick={() => onDismiss(task)} className={`${actionLinkClass} text-rose-700`}>Respinge</button> : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TaskDetailModal({
  task,
  open,
  localizedPath,
  onClose,
  onProgress,
  onComplete,
  onDismiss,
}: {
  task: any | null;
  open: boolean;
  localizedPath: (path: string) => string;
  onClose: () => void;
  onProgress: (task: any) => void;
  onComplete: (task: any) => void;
  onDismiss: (task: any) => void;
}) {
  if (!task) return null;
  return (
    <Modal isOpen={open} onClose={onClose} maxWidth="2xl">
      <ModalHeader title="Detalii task" onClose={onClose} />
      <ModalBody>
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground">{task.title}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant={statusTone(task.status)}>{statusLabels[task.status] || task.status}</Badge>
              <Badge variant={priorityTone(task.priority)}>{priorityLabels[task.priority] || task.priority}</Badge>
              <Badge variant="neutral">{typeLabels[task.type] || task.type}</Badge>
            </div>
          </div>
          {task.description ? <p className="rounded-lg border border-border/70 p-3 text-sm text-muted-foreground">{task.description}</p> : null}
          <div className="grid gap-3 md:grid-cols-2">
            <Info label="Organizație" value={task.organization?.name || '-'} />
            <Info label="Scadență" value={date(task.dueDate)} />
            <Info label="Contract" value={task.contract?.status || '-'} />
            <Info label="Abonament" value={task.subscription?.status || '-'} />
            <Info label="Plan" value={task.subscription?.planName || '-'} />
            <Info label="Creat la" value={date(task.createdAt)} />
          </div>
          {task.internalNote ? <Info label="Notă internă" value={task.internalNote} /> : null}
        </div>
      </ModalBody>
      <ModalFooter>
        {task.organization ? (
          <Link href={localizedPath(`/superadmin/organizations/${task.organization.id}?tab=contract`)} className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-border/70 px-4 text-sm font-semibold text-foreground hover:bg-muted/60">
            Deschide contract
            <ArrowRight className="h-4 w-4" />
          </Link>
        ) : null}
        {task.status === 'OPEN' ? <button type="button" onClick={() => onProgress(task)} className="rounded-2xl border border-border/70 px-4 py-2 text-sm font-semibold">Marchează în lucru</button> : null}
        <button type="button" onClick={() => onComplete(task)} className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
          <CheckCircle2 className="h-4 w-4" />
          Finalizează
        </button>
        <button type="button" onClick={() => onDismiss(task)} className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700">
          <XCircle className="h-4 w-4" />
          Respinge
        </button>
      </ModalFooter>
    </Modal>
  );
}

function Field({ label, value, onChange, type = 'text', required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) {
  return (
    <label className="block">
      <span className="label">{label}{required ? ' *' : ''}</span>
      <input className="input" type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function SelectField({ label, value, options, labels, onChange, allLabel }: { label: string; value: string; options: string[]; labels: Record<string, string>; onChange: (value: string) => void; allLabel?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <select className="select" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option || 'all'} value={option}>{option ? labels[option] || option : allLabel || 'Toate'}</option>)}
      </select>
    </label>
  );
}

function Info({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-border/70 p-3">
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <div className="mt-1 text-sm font-medium text-foreground">{value || '-'}</div>
    </div>
  );
}

function Notice({ tone, children, className = '' }: { tone: 'success' | 'error'; children: ReactNode; className?: string }) {
  const classes = tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800';
  return <div className={`rounded-2xl border px-4 py-3 text-sm font-medium ${classes} ${className}`.trim()}>{children}</div>;
}

function priorityTone(value?: string): 'default' | 'success' | 'warning' | 'error' | 'neutral' {
  if (value === 'URGENT') return 'error';
  if (value === 'HIGH') return 'warning';
  if (value === 'LOW') return 'neutral';
  return 'default';
}

function statusTone(value?: string): 'default' | 'success' | 'warning' | 'error' | 'neutral' {
  if (value === 'DONE') return 'success';
  if (value === 'IN_PROGRESS') return 'warning';
  if (value === 'DISMISSED') return 'neutral';
  return 'default';
}

function contractTone(value?: string): 'default' | 'success' | 'warning' | 'error' | 'neutral' {
  if (value === 'ACTIVE' || value === 'SIGNED') return 'success';
  if (value === 'EXPIRED' || value === 'CANCELLED') return 'error';
  if (value === 'DRAFT' || value === 'SENT') return 'warning';
  return 'neutral';
}

function subscriptionTone(value?: string): 'default' | 'success' | 'warning' | 'error' | 'neutral' {
  if (value === 'ACTIVE') return 'success';
  if (value === 'TRIAL') return 'warning';
  if (value === 'PAST_DUE' || value === 'PAUSED' || value === 'SUSPENDED' || value === 'CANCELLED') return 'error';
  return 'neutral';
}

function date(value?: string | Date | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('ro-MD');
}
