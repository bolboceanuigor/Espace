'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AlertTriangle, Check, Copy, RotateCcw, Save, ShieldCheck, Trash2, Users } from 'lucide-react';
import { adminRbacApi } from '@/lib/api';
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
  const { data, loading, error } = useLoad<any>(() => adminRbacApi.teamMembers(), []);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Echipă"
        description="Membrii interni ai asociației și rolurile lor RBAC."
        actions={
          <>
            <ButtonLink href="/admin/settings/roles" variant="secondary">
              Roluri
            </ButtonLink>
            <ButtonLink href="/admin/settings/permissions">Permission matrix</ButtonLink>
          </>
        }
      />
      {loading ? <LoadingCard /> : null}
      {error ? <ErrorCard message={error} /> : null}
      {!loading && !error && !data?.items?.length ? (
        <EmptyState
          title="Membrul nu are rol asignat"
          description="Asignează un rol pentru a-i controla accesul în aplicație."
          action={<ButtonLink href="/admin/settings/roles">Vezi roluri</ButtonLink>}
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
                      <StatusBadge status={member.status || 'ACTIVE'} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ButtonLink href={`/admin/team/${member.id}/permissions`} variant="secondary" size="sm">
                        Permisiuni
                      </ButtonLink>
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
