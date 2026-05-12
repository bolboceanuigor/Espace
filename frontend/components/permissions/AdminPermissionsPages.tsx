'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AlertTriangle, Check, Copy, Mail, RefreshCw, RotateCcw, Save, Send, ShieldCheck, Trash2, UserPlus, Users } from 'lucide-react';
import { adminRbacApi, staffInvitationsApi } from '@/lib/api';
import { saveAuth } from '@/lib/auth';
import { useLocalizedPath } from '@/lib/use-localized-path';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  Input,
  PageHeader,
  StatusBadge,
  VariantBadge,
} from '@/components/ui';
import ConfirmModal from '@/components/ui/ConfirmModal';

type Permission = {
  id: string;
  module: string;
  action: string;
  key: string;
  label: string;
  description?: string | null;
  isCritical?: boolean;
};

type PermissionGroup = {
  module: string;
  label: string;
  permissions: Permission[];
};

type RoleItem = {
  id: string;
  name: string;
  description?: string | null;
  type: string;
  isSystem: boolean;
  isDefault: boolean;
  membersCount: number;
  permissions: Record<string, boolean>;
  allowedPermissions?: string[];
};

type MatrixPayload = {
  roles: RoleItem[];
  permissions: Permission[];
  modules: PermissionGroup[];
  actions: string[];
  criticalPermissions: string[];
};

const actionLabels: Record<string, string> = {
  VIEW: 'View',
  CREATE: 'Create',
  UPDATE: 'Update',
  DELETE: 'Delete',
  APPROVE: 'Approve',
  CANCEL: 'Cancel',
  EXPORT: 'Export',
  IMPORT: 'Import',
  MANAGE: 'Manage',
  FINALIZE: 'Finalize',
  LOCK: 'Lock',
  ASSIGN: 'Assign',
  INVITE: 'Invite',
};

const typeLabels: Record<string, string> = {
  ASSOCIATION_OWNER: 'Administrator principal',
  ASSOCIATION_ADMIN: 'Administrator',
  FINANCE_OPERATOR: 'Operator financiar',
  METER_OPERATOR: 'Operator contoare',
  SUPPORT_OPERATOR: 'Suport locatari',
  READ_ONLY: 'Vizualizare',
  CUSTOM: 'Custom',
};

const staffStatusLabels: Record<string, string> = {
  INVITED: 'Invitat',
  ACTIVE: 'Activ',
  SUSPENDED: 'Suspendat',
  REVOKED: 'Revocat',
  DISABLED: 'Dezactivat',
};

const invitationStatusLabels: Record<string, string> = {
  DRAFT: 'Draft',
  PENDING: 'În așteptare',
  SENT: 'Trimisă',
  ACCEPTED: 'Acceptată',
  EXPIRED: 'Expirată',
  CANCELLED: 'Anulată',
  REVOKED: 'Revocată',
};

const deliveryMethodLabels: Record<string, string> = {
  COPY_LINK: 'Copiază link',
  EMAIL_PLACEHOLDER: 'Email placeholder',
  MANUAL: 'Manual',
};

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ro-MD', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function badgeVariant(status?: string): 'success' | 'warning' | 'error' | 'neutral' | 'info' {
  if (status === 'ACTIVE' || status === 'ACCEPTED') return 'success';
  if (status === 'PENDING' || status === 'SENT' || status === 'INVITED') return 'warning';
  if (status === 'SUSPENDED' || status === 'REVOKED' || status === 'EXPIRED' || status === 'CANCELLED' || status === 'DISABLED') return 'error';
  return 'neutral';
}

async function copyText(value?: string) {
  if (!value || typeof navigator === 'undefined') return;
  await navigator.clipboard?.writeText(value);
}

function useLoad<T>(loader: () => Promise<{ data: T }>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    loader()
      .then((response) => {
        if (active) setData(response.data);
      })
      .catch((err: any) => {
        if (active) setError(String(err?.message || 'Nu am putut încărca datele.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, setData, loading, error };
}

function LoadingCard() {
  return (
    <div className="space-y-3">
      <div className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white" />
      <div className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-white" />
    </div>
  );
}

function ErrorCard({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card className="border-rose-200 bg-rose-50">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-rose-800">Nu am putut încărca modulul</p>
          <p className="mt-1 text-sm text-rose-700">{message}</p>
        </div>
        {onRetry ? (
          <Button variant="secondary" onClick={onRetry}>
            Reîncearcă
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

function roleBadge(role: RoleItem) {
  if (role.isDefault) return <VariantBadge variant="success">Default</VariantBadge>;
  if (role.isSystem) return <VariantBadge variant="info">System</VariantBadge>;
  return <VariantBadge>Custom</VariantBadge>;
}

function PermissionSummary({ permissions }: { permissions: Record<string, boolean> }) {
  const allowed = Object.entries(permissions).filter(([, value]) => value);
  return (
    <div className="flex flex-wrap gap-2">
      {allowed.slice(0, 10).map(([key]) => (
        <Badge key={key}>{key}</Badge>
      ))}
      {allowed.length > 10 ? <Badge>+{allowed.length - 10}</Badge> : null}
      {!allowed.length ? <span className="text-sm text-slate-500">Fără permisiuni active</span> : null}
    </div>
  );
}

export function RolesListPage() {
  const localizedPath = useLocalizedPath();
  const { data, setData, loading, error } = useLoad<{ items: RoleItem[] }>(() => adminRbacApi.roles(), []);
  const [busyId, setBusyId] = useState('');

  const duplicate = async (id: string) => {
    setBusyId(id);
    try {
      const created = await adminRbacApi.duplicateRole(id);
      setData((current) => ({ items: [...(current?.items || []), created.data] }));
    } finally {
      setBusyId('');
    }
  };

  const remove = async (id: string) => {
    setBusyId(id);
    try {
      await adminRbacApi.deleteRole(id);
      setData((current) => ({ items: (current?.items || []).filter((role) => role.id !== id) }));
    } finally {
      setBusyId('');
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Roluri echipă"
        description="Configurează rolurile interne ale asociației și controlează accesul pe module."
        badge={<StatusBadge status="ACTIVE" label="RBAC activ" />}
        actions={<ButtonLink href="/admin/settings/roles/new">Rol nou</ButtonLink>}
      />
      {loading ? <LoadingCard /> : null}
      {error ? <ErrorCard message={error} /> : null}
      {!loading && !error && !data?.items?.length ? (
        <EmptyState
          title="Nu există roluri personalizate"
          description="Folosește rolurile presetate sau creează un rol nou pentru echipa ta."
          action={<ButtonLink href="/admin/settings/roles/new">Creează rol</ButtonLink>}
        />
      ) : null}
      {!loading && !error && data?.items?.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.items.map((role) => (
            <Card key={role.id} className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold text-slate-950">{role.name}</h2>
                    {roleBadge(role)}
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{role.description || typeLabels[role.type] || role.type}</p>
                </div>
                <Badge>{role.membersCount} membri</Badge>
              </div>
              <PermissionSummary permissions={role.permissions || {}} />
              <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4">
                <ButtonLink href={`/admin/settings/roles/${role.id}`} variant="secondary" size="sm">
                  Deschide
                </ButtonLink>
                <ButtonLink href={`/admin/settings/roles/${role.id}/edit`} variant="outline" size="sm">
                  Editează
                </ButtonLink>
                <Button variant="ghost" size="sm" onClick={() => duplicate(role.id)} isLoading={busyId === role.id}>
                  <Copy className="h-4 w-4" /> Duplicate
                </Button>
                {!role.isSystem && role.membersCount === 0 ? (
                  <Button variant="danger" size="sm" onClick={() => remove(role.id)} isLoading={busyId === role.id}>
                    <Trash2 className="h-4 w-4" /> Delete
                  </Button>
                ) : null}
                <Link href={localizedPath('/admin/settings/permissions')} className="ml-auto text-sm font-medium text-slate-600 hover:text-slate-950">
                  Matrix
                </Link>
              </div>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PermissionMatrix({
  matrix,
  selectedRole,
  permissions,
  setPermissions,
}: {
  matrix: MatrixPayload;
  selectedRole: RoleItem;
  permissions: Record<string, boolean>;
  setPermissions: (next: Record<string, boolean>) => void;
}) {
  const byModule = matrix.modules;
  const critical = new Set(matrix.criticalPermissions || []);
  return (
    <Card noPadding className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="sticky left-0 z-10 min-w-52 border-b border-slate-200 bg-slate-50 px-4 py-3 text-left">Modul</th>
              {matrix.actions.map((action) => (
                <th key={action} className="border-b border-slate-200 px-3 py-3 text-center">
                  {actionLabels[action] || action}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {byModule.map((group) => {
              const byAction = new Map(group.permissions.map((permission) => [permission.action, permission]));
              return (
                <tr key={group.module}>
                  <td className="sticky left-0 z-10 border-r border-slate-100 bg-white px-4 py-3">
                    <p className="font-semibold text-slate-900">{group.label || group.module}</p>
                    <p className="text-xs text-slate-500">{group.module}</p>
                  </td>
                  {matrix.actions.map((action) => {
                    const permission = byAction.get(action);
                    if (!permission) return <td key={action} className="px-3 py-3 text-center text-slate-300">-</td>;
                    const checked = permissions[permission.key] === true;
                    return (
                      <td key={permission.key} className="px-3 py-3 text-center">
                        <label className="inline-flex cursor-pointer items-center justify-center">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) => setPermissions({ ...permissions, [permission.key]: event.target.checked })}
                            className="h-4 w-4 rounded border-slate-300 text-slate-950 focus:ring-slate-950"
                            aria-label={`${selectedRole.name}: ${permission.label}`}
                          />
                        </label>
                        {critical.has(permission.key) ? <AlertTriangle className="mx-auto mt-1 h-3.5 w-3.5 text-amber-500" /> : null}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function PermissionsMatrixPage() {
  const { data, setData, loading, error } = useLoad<MatrixPayload>(() => adminRbacApi.matrix(), []);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmedCritical, setConfirmedCritical] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const selectedRole = useMemo(() => data?.roles?.find((role) => role.id === selectedRoleId) || data?.roles?.[0], [data, selectedRoleId]);

  useEffect(() => {
    if (!data?.roles?.length) return;
    if (!selectedRoleId) setSelectedRoleId(data.roles[0].id);
  }, [data, selectedRoleId]);

  useEffect(() => {
    if (selectedRole) setPermissions({ ...(selectedRole.permissions || {}) });
  }, [selectedRole]);

  const criticalChanged = useMemo(() => {
    if (!data || !selectedRole) return false;
    return (data.criticalPermissions || []).some((key) => permissions[key] === true && selectedRole.permissions?.[key] !== true);
  }, [data, permissions, selectedRole]);

  const save = async () => {
    if (!selectedRole) return;
    if (criticalChanged && !confirmedCritical) {
      setConfirmOpen(true);
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const updated = await adminRbacApi.updateMatrix(selectedRole.id, permissions, confirmedCritical || !criticalChanged);
      setData((current) =>
        current
          ? {
              ...current,
              roles: current.roles.map((role) => (role.id === selectedRole.id ? updated.data : role)),
            }
          : current,
      );
      setMessage('Permisiunile au fost salvate.');
      setConfirmOpen(false);
      setConfirmedCritical(false);
    } finally {
      setSaving(false);
    }
  };

  const resetPreset = async () => {
    if (!selectedRole) return;
    setSaving(true);
    try {
      const updated = await adminRbacApi.resetPreset(selectedRole.id);
      setData((current) =>
        current
          ? {
              ...current,
              roles: current.roles.map((role) => (role.id === selectedRole.id ? updated.data : role)),
            }
          : current,
      );
      setPermissions(updated.data.permissions || {});
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Permission matrix"
        description="Controlează accesul pe module pentru fiecare rol intern al asociației."
        badge={<VariantBadge variant="info">Module guards</VariantBadge>}
        actions={
          <>
            {selectedRole?.isSystem ? (
              <Button variant="secondary" onClick={resetPreset} disabled={saving}>
                <RotateCcw className="h-4 w-4" /> Reset preset
              </Button>
            ) : null}
            <Button onClick={save} isLoading={saving}>
              <Save className="h-4 w-4" /> Salvează
            </Button>
          </>
        }
      />
      {loading ? <LoadingCard /> : null}
      {error ? <ErrorCard message={error} /> : null}
      {!loading && !error && data && selectedRole ? (
        <>
          <Card className="flex flex-wrap items-center gap-3">
            <label className="text-sm font-medium text-slate-700" htmlFor="roleId">
              Rol
            </label>
            <select
              id="roleId"
              value={selectedRole.id}
              onChange={(event) => setSelectedRoleId(event.target.value)}
              className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-950/10"
            >
              {data.roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
            {roleBadge(selectedRole)}
            <span className="text-sm text-slate-500">{selectedRole.membersCount} membri</span>
            {message ? <span className="ml-auto text-sm font-medium text-emerald-700">{message}</span> : null}
          </Card>
          <PermissionMatrix matrix={data} selectedRole={selectedRole} permissions={permissions} setPermissions={setPermissions} />
        </>
      ) : null}
      <ConfirmModal
        open={confirmOpen}
        title="Confirmă permisiuni critice"
        description="Aceste permisiuni pot afecta date financiare, utilizatori sau setări importante."
        confirmLabel="Confirm și salvez"
        disabled={!confirmedCritical}
        isLoading={saving}
        onClose={() => setConfirmOpen(false)}
        onConfirm={save}
      >
        <label className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <input
            type="checkbox"
            checked={confirmedCritical}
            onChange={(event) => setConfirmedCritical(event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-amber-300"
          />
          <span>Confirm că înțeleg impactul acestor permisiuni.</span>
        </label>
      </ConfirmModal>
    </div>
  );
}

export function RoleDetailPage() {
  const params = useParams<{ id?: string }>();
  const id = String(params?.id || '');
  const { data: role, loading, error } = useLoad<RoleItem>(() => adminRbacApi.role(id), [id]);

  return (
    <div className="space-y-5">
      <PageHeader
        title={role?.name || 'Rol'}
        description={role?.description || 'Detalii rol și permisiuni asignate.'}
        backHref="/admin/settings/roles"
        badge={role ? roleBadge(role) : null}
        actions={role ? <ButtonLink href={`/admin/settings/roles/${role.id}/edit`}>Editează permisiuni</ButtonLink> : null}
      />
      {loading ? <LoadingCard /> : null}
      {error ? <ErrorCard message={error} /> : null}
      {role ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <Card>
            <h2 className="text-base font-semibold text-slate-950">Permission summary</h2>
            <div className="mt-4">
              <PermissionSummary permissions={role.permissions || {}} />
            </div>
          </Card>
          <Card className="space-y-3">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-slate-400" />
              <div>
                <p className="font-semibold text-slate-950">{role.membersCount} membri</p>
                <p className="text-sm text-slate-500">Membri cu acest rol</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-slate-400" />
              <div>
                <p className="font-semibold text-slate-950">{typeLabels[role.type] || role.type}</p>
                <p className="text-sm text-slate-500">Tip rol</p>
              </div>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

export function RoleEditPage({ mode = 'edit' }: { mode?: 'new' | 'edit' }) {
  const params = useParams<{ id?: string }>();
  const router = useRouter();
  const localizedPath = useLocalizedPath();
  const id = String(params?.id || '');
  const { data: matrix, loading, error } = useLoad<MatrixPayload>(() => adminRbacApi.matrix(), []);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmedCritical, setConfirmedCritical] = useState(false);

  const role = matrix?.roles?.find((item) => item.id === id);

  useEffect(() => {
    if (mode === 'edit' && role) {
      setName(role.name || '');
      setDescription(role.description || '');
      setPermissions({ ...(role.permissions || {}) });
    }
  }, [mode, role]);

  const grantsCritical = useMemo(
    () => Boolean(matrix?.criticalPermissions?.some((key) => permissions[key] === true && (mode === 'new' || role?.permissions?.[key] !== true))),
    [matrix, mode, permissions, role],
  );

  const submit = async () => {
    if (grantsCritical && !confirmedCritical) {
      setConfirmOpen(true);
      return;
    }
    setSaving(true);
    try {
      if (mode === 'new') {
        const created = await adminRbacApi.createRole({ name, description, permissions });
        router.push(localizedPath(`/admin/settings/roles/${created.data.id}/edit`));
      } else if (role) {
        await adminRbacApi.updateRole(role.id, { name, description });
        await adminRbacApi.updateRolePermissions(role.id, permissions, confirmedCritical || !grantsCritical);
        router.push(localizedPath(`/admin/settings/roles/${role.id}`));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={mode === 'new' ? 'Rol nou' : 'Editează rol'}
        description="Configurează numele, descrierea și permisiunile rolului."
        backHref="/admin/settings/roles"
        actions={
          <Button onClick={submit} isLoading={saving} disabled={!name.trim()}>
            <Save className="h-4 w-4" /> Salvează
          </Button>
        }
      />
      {loading ? <LoadingCard /> : null}
      {error ? <ErrorCard message={error} /> : null}
      {matrix && (mode === 'new' || role) ? (
        <>
          <Card className="grid gap-4 md:grid-cols-2">
            <Input label="Nume rol" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex: Operator financiar senior" />
            <Input label="Descriere" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Scopul rolului în echipă" />
          </Card>
          <PermissionMatrix
            matrix={matrix}
            selectedRole={role || ({ id: 'new', name: name || 'Rol nou', permissions: {}, membersCount: 0 } as RoleItem)}
            permissions={permissions}
            setPermissions={setPermissions}
          />
        </>
      ) : null}
      <ConfirmModal
        open={confirmOpen}
        title="Confirmă permisiuni critice"
        description="Aceste permisiuni pot afecta date financiare, utilizatori sau setări importante."
        confirmLabel="Confirm și salvez"
        disabled={!confirmedCritical}
        isLoading={saving}
        onClose={() => setConfirmOpen(false)}
        onConfirm={submit}
      >
        <label className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <input
            type="checkbox"
            checked={confirmedCritical}
            onChange={(event) => setConfirmedCritical(event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-amber-300"
          />
          <span>Confirm că înțeleg impactul acestor permisiuni.</span>
        </label>
      </ConfirmModal>
    </div>
  );
}

export function TeamMemberPermissionsPage() {
  const params = useParams<{ id?: string }>();
  const id = String(params?.id || '');
  const { data, setData, loading, error } = useLoad<any>(() => adminRbacApi.teamMemberPermissions(id), [id]);
  const [roleId, setRoleId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data?.member?.roleId) setRoleId(data.member.roleId);
  }, [data?.member?.roleId]);

  const save = async () => {
    if (!roleId) return;
    setSaving(true);
    try {
      const updated = await adminRbacApi.updateTeamMemberRole(id, roleId);
      setData(updated.data);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Permisiuni membru"
        description="Asignează un rol intern și verifică permisiunile efective."
        backHref="/admin/team"
        actions={
          <Button onClick={save} isLoading={saving} disabled={!roleId || roleId === data?.member?.roleId}>
            <Check className="h-4 w-4" /> Schimbă rolul
          </Button>
        }
      />
      {loading ? <LoadingCard /> : null}
      {error ? <ErrorCard message={error} /> : null}
      {data ? (
        <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <Card className="space-y-4">
            <div>
              <p className="text-sm text-slate-500">Membru</p>
              <p className="font-semibold text-slate-950">{data.member?.fullName}</p>
              <p className="text-sm text-slate-500">{data.member?.email}</p>
            </div>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Rol curent</span>
              <select
                value={roleId}
                onChange={(event) => setRoleId(event.target.value)}
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-950/10"
              >
                <option value="">Alege rol</option>
                {(data.availableRoles || []).map((role: RoleItem) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </label>
            <p className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Nu poți elimina ultimul Administrator principal al asociației.
            </p>
          </Card>
          <Card>
            <h2 className="text-base font-semibold text-slate-950">Permisiuni efective</h2>
            <div className="mt-4">
              <PermissionSummary permissions={data.permissions || {}} />
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

export function TeamPermissionsListPage() {
  const { data, setData, loading, error } = useLoad<any>(() => adminRbacApi.teamMembers(), []);
  const [busyId, setBusyId] = useState('');

  const refresh = async () => {
    const next = await adminRbacApi.teamMembers();
    setData(next.data);
  };

  const memberAction = async (memberId: string, action: 'suspend' | 'reactivate' | 'revoke') => {
    const reason =
      action === 'reactivate'
        ? 'Reactivat manual'
        : typeof window !== 'undefined'
          ? window.prompt(action === 'suspend' ? 'Motiv suspendare' : 'Motiv revocare') || ''
          : '';
    if (action !== 'reactivate' && !reason.trim()) return;
    setBusyId(memberId);
    try {
      if (action === 'suspend') await adminRbacApi.suspendTeamMember(memberId, reason);
      if (action === 'reactivate') await adminRbacApi.reactivateTeamMember(memberId, reason);
      if (action === 'revoke') await adminRbacApi.revokeTeamMember(memberId, reason);
      await refresh();
    } finally {
      setBusyId('');
    }
  };
  const stats = data?.stats || {};

  return (
    <div className="space-y-5">
      <PageHeader
        title="Echipă"
        description="Gestionează membrii echipei și accesul lor în aplicație."
        actions={
          <>
            <ButtonLink href="/admin/team/invitations/new">
              <UserPlus className="h-4 w-4" /> Invită membru
            </ButtonLink>
            <ButtonLink href="/admin/team/invitations" variant="secondary">
              Invitații
            </ButtonLink>
            <ButtonLink href="/admin/settings/roles" variant="secondary">
              Roluri
            </ButtonLink>
            <ButtonLink href="/admin/settings/permissions" variant="outline">Permisiuni</ButtonLink>
          </>
        }
      />
      {!loading && !error ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          {[
            ['Membri activi', stats.active ?? 0],
            ['Invitații pending', stats.pendingInvitations ?? 0],
            ['Invitații expirate', stats.expiredInvitations ?? 0],
            ['Membri suspendați', stats.suspended ?? 0],
            ['Revocați', stats.revoked ?? 0],
            ['Roluri custom', stats.customRoles ?? 0],
          ].map(([label, value]) => (
            <Card key={String(label)} className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
            </Card>
          ))}
        </div>
      ) : null}
      {loading ? <LoadingCard /> : null}
      {error ? <ErrorCard message={error} /> : null}
      {!loading && !error && !data?.items?.length ? (
        <EmptyState
          title="Nu există membri în echipă"
          description="Invită primul membru pentru a lucra împreună în administrarea asociației."
          action={<ButtonLink href="/admin/team/invitations/new">Invită membru</ButtonLink>}
        />
      ) : null}
      {!loading && !error && data?.items?.length ? (
        <Card noPadding className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">Membru</th>
                  <th className="px-4 py-3 text-left">Rol</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Ultima autentificare</th>
                  <th className="px-4 py-3 text-left">Activat la</th>
                  <th className="px-4 py-3 text-right">Acțiuni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {data.items.map((member: any) => (
                  <tr key={member.id}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-950">{member.fullName}</p>
                      <p className="text-xs text-slate-500">{member.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{member.role?.name || member.legacyRole || 'Fără rol'}</p>
                      <p className="text-xs text-slate-500">{member.role?.type || 'Legacy'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <VariantBadge variant={badgeVariant(member.status)}>{staffStatusLabels[member.status] || member.status}</VariantBadge>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(member.lastLoginAt)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(member.activatedAt || member.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <ButtonLink href={`/admin/team/${member.id}`} variant="secondary" size="sm">Deschide</ButtonLink>
                        <ButtonLink href={`/admin/team/${member.id}/permissions`} variant="outline" size="sm">Rol</ButtonLink>
                        {member.status === 'ACTIVE' ? (
                          <Button size="sm" variant="ghost" isLoading={busyId === member.id} onClick={() => memberAction(member.id, 'suspend')}>Suspendă</Button>
                        ) : member.status === 'SUSPENDED' ? (
                          <Button size="sm" variant="ghost" isLoading={busyId === member.id} onClick={() => memberAction(member.id, 'reactivate')}>Reactivează</Button>
                        ) : null}
                        {member.status !== 'REVOKED' ? (
                          <Button size="sm" variant="danger" isLoading={busyId === member.id} onClick={() => memberAction(member.id, 'revoke')}>Revocă</Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

export function TeamMemberDetailPage() {
  const params = useParams<{ id?: string }>();
  const id = String(params?.id || '');
  const { data, loading, error } = useLoad<any>(() => adminRbacApi.teamMember(id), [id]);

  return (
    <div className="space-y-5">
      <PageHeader
        title={data?.fullName || 'Membru echipă'}
        description={data?.email || 'Detalii membru intern și activitate.'}
        backHref="/admin/team"
        badge={data?.status ? <VariantBadge variant={badgeVariant(data.status)}>{staffStatusLabels[data.status] || data.status}</VariantBadge> : null}
        actions={<ButtonLink href={`/admin/team/${id}/permissions`}>Schimbă rol</ButtonLink>}
      />
      {loading ? <LoadingCard /> : null}
      {error ? <ErrorCard message={error} /> : null}
      {data ? (
        <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <Card className="space-y-4">
            <div>
              <p className="text-sm text-slate-500">Rol</p>
              <p className="font-semibold text-slate-950">{data.role?.name || data.legacyRole || 'Fără rol'}</p>
              <p className="text-sm text-slate-500">{data.role?.type || 'Legacy'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Activat la</p>
              <p className="font-medium text-slate-900">{formatDate(data.activatedAt || data.createdAt)}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Ultima autentificare</p>
              <p className="font-medium text-slate-900">{formatDate(data.lastLoginAt)}</p>
            </div>
          </Card>
          <Card>
            <h2 className="text-base font-semibold text-slate-950">Permisiuni efective</h2>
            <div className="mt-4">
              <PermissionSummary permissions={data.permissions || {}} />
            </div>
          </Card>
          <Card className="lg:col-span-2">
            <h2 className="text-base font-semibold text-slate-950">Activitate recentă</h2>
            <div className="mt-4 divide-y divide-slate-100">
              {(data.activity || []).map((item: any) => (
                <div key={item.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div>
                    <p className="font-medium text-slate-900">{item.description || item.action}</p>
                    <p className="text-xs text-slate-500">{item.action} · {item.entityType}</p>
                  </div>
                  <span className="text-xs text-slate-500">{formatDate(item.createdAt)}</span>
                </div>
              ))}
              {!data.activity?.length ? <p className="text-sm text-slate-500">Nu există activitate recentă.</p> : null}
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

export function TeamInvitationsPage() {
  const { data, setData, loading, error } = useLoad<any>(() => adminRbacApi.staffInvitations(), []);
  const [busyId, setBusyId] = useState('');

  const refresh = async () => setData((await adminRbacApi.staffInvitations()).data);
  const run = async (id: string, action: 'sent' | 'regenerate' | 'cancel' | 'revoke') => {
    setBusyId(id);
    try {
      let response: any = null;
      if (action === 'sent') response = await adminRbacApi.markStaffInvitationSent(id);
      if (action === 'regenerate') response = await adminRbacApi.regenerateStaffInvitation(id);
      if (action === 'cancel') response = await adminRbacApi.cancelStaffInvitation(id, 'Anulată manual');
      if (action === 'revoke') response = await adminRbacApi.revokeStaffInvitation(id, 'Revocată manual');
      if (response?.data?.inviteLink) await copyText(response.data.inviteLink);
      await refresh();
    } finally {
      setBusyId('');
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Invitații echipă"
        description="Urmărește invitațiile trimise membrilor echipei interne."
        backHref="/admin/team"
        actions={<ButtonLink href="/admin/team/invitations/new"><UserPlus className="h-4 w-4" /> Creează invitație</ButtonLink>}
      />
      {loading ? <LoadingCard /> : null}
      {error ? <ErrorCard message={error} /> : null}
      {!loading && !error && !data?.items?.length ? (
        <EmptyState title="Nu există invitații" description="Invitațiile create pentru echipa internă vor apărea aici." action={<ButtonLink href="/admin/team/invitations/new">Creează invitație</ButtonLink>} />
      ) : null}
      {!loading && !error && data?.items?.length ? (
        <Card noPadding className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">Invitat</th>
                  <th className="px-4 py-3 text-left">Rol</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Expiră la</th>
                  <th className="px-4 py-3 text-left">Creată de</th>
                  <th className="px-4 py-3 text-right">Acțiuni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {data.items.map((item: any) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-950">{item.invitedFullName || item.invitedEmail}</p>
                      <p className="text-xs text-slate-500">{item.invitedEmail}</p>
                    </td>
                    <td className="px-4 py-3">{item.role?.name || '—'}</td>
                    <td className="px-4 py-3"><VariantBadge variant={badgeVariant(item.status)}>{invitationStatusLabels[item.status] || item.status}</VariantBadge></td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(item.expiresAt)}</td>
                    <td className="px-4 py-3 text-slate-600">{item.createdBy?.fullName || item.createdBy?.email || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <ButtonLink href={`/admin/team/invitations/${item.id}`} variant="secondary" size="sm">Deschide</ButtonLink>
                        {['PENDING', 'SENT', 'EXPIRED'].includes(item.status) ? (
                          <Button size="sm" variant="ghost" isLoading={busyId === item.id} onClick={() => run(item.id, 'regenerate')}><RefreshCw className="h-4 w-4" /> Link</Button>
                        ) : null}
                        {['PENDING', 'SENT'].includes(item.status) ? (
                          <Button size="sm" variant="ghost" isLoading={busyId === item.id} onClick={() => run(item.id, 'sent')}><Send className="h-4 w-4" /> Trimisă</Button>
                        ) : null}
                        {['PENDING', 'SENT', 'EXPIRED'].includes(item.status) ? (
                          <Button size="sm" variant="danger" isLoading={busyId === item.id} onClick={() => run(item.id, 'cancel')}>Anulează</Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

export function TeamInvitationNewPage() {
  const router = useRouter();
  const localizedPath = useLocalizedPath();
  const { data: matrix, loading, error } = useLoad<MatrixPayload>(() => adminRbacApi.matrix(), []);
  const [form, setForm] = useState<{
    invitedFullName: string;
    invitedEmail: string;
    invitedPhone: string;
    roleId: string;
    deliveryMethod: 'COPY_LINK' | 'EMAIL_PLACEHOLDER' | 'MANUAL';
    expiresInDays: number;
    message: string;
  }>({ invitedFullName: '', invitedEmail: '', invitedPhone: '', roleId: '', deliveryMethod: 'COPY_LINK', expiresInDays: 7, message: '' });
  const [confirmCritical, setConfirmCritical] = useState(false);
  const [createdLink, setCreatedLink] = useState('');
  const [saving, setSaving] = useState(false);
  const selectedRole = matrix?.roles?.find((role) => role.id === form.roleId);
  const critical = useMemo(() => {
    if (!selectedRole || !matrix) return [];
    return (matrix.criticalPermissions || []).filter((key) => selectedRole.permissions?.[key]);
  }, [matrix, selectedRole]);

  useEffect(() => {
    if (!form.roleId && matrix?.roles?.length) setForm((current) => ({ ...current, roleId: matrix.roles[0].id }));
  }, [form.roleId, matrix]);

  const submit = async () => {
    setSaving(true);
    try {
      const response = await adminRbacApi.createStaffInvitation({ ...form, confirmCritical });
      setCreatedLink(response.data.inviteLink || '');
      if (response.data.inviteLink) await copyText(response.data.inviteLink);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Invită membru" description="Creează o invitație securizată pentru echipa internă." backHref="/admin/team" />
      {loading ? <LoadingCard /> : null}
      {error ? <ErrorCard message={error} /> : null}
      {matrix ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
          <Card className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Input label="Nume invitat" value={form.invitedFullName} onChange={(event) => setForm({ ...form, invitedFullName: event.target.value })} />
              <Input label="Email" type="email" value={form.invitedEmail} onChange={(event) => setForm({ ...form, invitedEmail: event.target.value })} />
              <Input label="Telefon" value={form.invitedPhone} onChange={(event) => setForm({ ...form, invitedPhone: event.target.value })} />
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-slate-700">Rol</span>
                <select value={form.roleId} onChange={(event) => setForm({ ...form, roleId: event.target.value })} className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm">
                  {matrix.roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
                </select>
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-slate-700">Metodă</span>
                <select value={form.deliveryMethod} onChange={(event) => setForm({ ...form, deliveryMethod: event.target.value as typeof form.deliveryMethod })} className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm">
                  <option value="COPY_LINK">Copiază link</option>
                  <option value="EMAIL_PLACEHOLDER">Email placeholder</option>
                  <option value="MANUAL">Manual</option>
                </select>
              </label>
              <Input label="Expiră în zile" type="number" value={String(form.expiresInDays)} onChange={(event) => setForm({ ...form, expiresInDays: Number(event.target.value) })} />
            </div>
            {critical.length ? (
              <label className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <input type="checkbox" checked={confirmCritical} onChange={(event) => setConfirmCritical(event.target.checked)} className="mt-1 h-4 w-4 rounded border-amber-300" />
                <span>Confirm că înțeleg permisiunile critice acordate acestui membru.</span>
              </label>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button onClick={submit} isLoading={saving} disabled={!form.invitedEmail || !form.roleId || (critical.length > 0 && !confirmCritical)}>
                <Mail className="h-4 w-4" /> Creează invitație
              </Button>
              {createdLink ? <Button variant="secondary" onClick={() => copyText(createdLink)}><Copy className="h-4 w-4" /> Copiază linkul</Button> : null}
              {createdLink ? <Button variant="ghost" onClick={() => router.push(localizedPath('/admin/team/invitations'))}>Vezi invitații</Button> : null}
            </div>
            {createdLink ? <p className="break-all rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{createdLink}</p> : null}
          </Card>
          <Card>
            <h2 className="text-base font-semibold text-slate-950">Permisiuni rol</h2>
            <p className="mt-1 text-sm text-slate-500">{selectedRole?.name || 'Alege un rol pentru preview.'}</p>
            <div className="mt-4">
              <PermissionSummary permissions={selectedRole?.permissions || {}} />
            </div>
            {critical.length ? <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Rolul conține permisiuni critice: {critical.join(', ')}</p> : null}
          </Card>
        </div>
      ) : null}
    </div>
  );
}

export function TeamInvitationDetailPage() {
  const params = useParams<{ id?: string }>();
  const id = String(params?.id || '');
  const { data, setData, loading, error } = useLoad<any>(() => adminRbacApi.staffInvitation(id), [id]);
  const [busy, setBusy] = useState(false);

  const regenerate = async () => {
    setBusy(true);
    try {
      const response = await adminRbacApi.regenerateStaffInvitation(id);
      setData(response.data);
      if (response.data.inviteLink) await copyText(response.data.inviteLink);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Detalii invitație"
        description={data?.invitedEmail || 'Invitație staff'}
        backHref="/admin/team/invitations"
        badge={data?.status ? <VariantBadge variant={badgeVariant(data.status)}>{invitationStatusLabels[data.status] || data.status}</VariantBadge> : null}
        actions={<Button onClick={regenerate} isLoading={busy} disabled={data?.status === 'ACCEPTED'}><RefreshCw className="h-4 w-4" /> Regenerează link</Button>}
      />
      {loading ? <LoadingCard /> : null}
      {error ? <ErrorCard message={error} /> : null}
      {data ? (
        <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <Card className="space-y-3">
            <InfoLine label="Invitat" value={data.invitedFullName || data.invitedEmail} />
            <InfoLine label="Email" value={data.invitedEmail} />
            <InfoLine label="Metodă" value={deliveryMethodLabels[data.deliveryMethod] || data.deliveryMethod} />
            <InfoLine label="Expiră la" value={formatDate(data.expiresAt)} />
            <InfoLine label="Acceptată la" value={formatDate(data.acceptedAt)} />
            <InfoLine label="Token preview" value={data.tokenPreview ? `...${data.tokenPreview}` : '—'} />
          </Card>
          <Card>
            <h2 className="text-base font-semibold text-slate-950">Rol și permisiuni</h2>
            <p className="mt-1 text-sm text-slate-500">{data.role?.name} · {data.role?.type}</p>
            <div className="mt-4 space-y-3">
              {(data.role?.permissionsPreview || []).map((group: any) => (
                <div key={group.module} className="rounded-2xl border border-slate-200 p-3">
                  <p className="text-sm font-semibold text-slate-900">{group.module}</p>
                  <div className="mt-2 flex flex-wrap gap-2">{group.actions.map((action: string) => <Badge key={action}>{action}</Badge>)}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

export function StaffInvitePublicPage({ accept = false }: { accept?: boolean }) {
  const params = useParams<{ token?: string; locale?: string }>();
  const router = useRouter();
  const token = String(params?.token || '');
  const locale = String(params?.locale || 'ro');
  const { data, loading, error } = useLoad<any>(() => staffInvitationsApi.validate(token), [token]);
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [saving, setSaving] = useState(false);
  const valid = data?.valid === true;

  useEffect(() => {
    if (data?.invitedEmail) {
      setForm((current) => ({ ...current, email: data.invitedEmail, fullName: data.invitedFullName || '' }));
    }
  }, [data?.invitedEmail, data?.invitedFullName]);

  const submit = async () => {
    setSaving(true);
    try {
      const response = await staffInvitationsApi.accept(token, form);
      const auth = response.data?.auth || response.data;
      if (auth?.accessToken && auth?.user) saveAuth(auth.accessToken, auth.user);
      router.push(`/${locale}/admin`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-5">
        <Card className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white"><ShieldCheck className="h-5 w-5" /></div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-950">Invitație în echipa Espace</h1>
              <p className="mt-1 text-sm text-slate-500">Activează accesul intern pentru administrarea asociației.</p>
            </div>
          </div>
          {loading ? <div className="h-32 animate-pulse rounded-2xl bg-slate-100" /> : null}
          {error ? <ErrorCard message={error} /> : null}
          {data && !valid ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800">
              <p className="font-semibold">Invitația nu mai este validă.</p>
              <p className="mt-1 text-sm">Invitația poate fi expirată, anulată sau deja acceptată.</p>
            </div>
          ) : null}
          {data && valid ? (
            <>
              <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
                <InfoLine label="Asociație" value={data.association?.shortName || 'Espace'} />
                <InfoLine label="Email invitat" value={data.invitedEmail} />
                <InfoLine label="Rol" value={data.role?.name || 'Membru echipă'} />
                <InfoLine label="Expiră la" value={formatDate(data.invitation?.expiresAt)} />
              </div>
              {!accept ? (
                <ButtonLink href={`/${locale}/staff-invite/${token}/accept`}>Acceptă invitația</ButtonLink>
              ) : (
                <div className="space-y-4">
                  <Input label="Nume complet" value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} />
                  <Input label="Email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
                  <Input label="Parolă" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
                  <Input label="Confirmă parola" type="password" value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} />
                  <Button onClick={submit} isLoading={saving} disabled={!form.email || !form.password || form.password !== form.confirmPassword}>
                    Creează cont și intră în Admin
                  </Button>
                </div>
              )}
            </>
          ) : null}
        </Card>
      </div>
    </main>
  );
}
