'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { defaultLocale, isLocale } from '@/i18n';
import { Button, Modal, ModalBody, ModalFooter, ModalHeader, PageHeader, useToast } from '@/components/ui';
import { teamApi } from '@/lib/api';

type TeamUser = {
  id: string;
  userId: string;
  email: string;
  fullName: string | null;
  role: 'ORG_ADMIN' | 'ACCOUNTANT' | 'MANAGER' | 'TECHNICIAN' | 'OPERATOR';
  status: 'ACTIVE' | 'INVITED' | 'DISABLED';
  permissions: Record<string, boolean>;
};

type InvitationItem = {
  id: string;
  email: string;
  role: 'ORG_ADMIN' | 'ACCOUNTANT' | 'MANAGER' | 'TECHNICIAN' | 'OPERATOR';
  status: 'INVITED' | 'ACTIVE' | 'DISABLED';
  createdAt: string;
  expiresAt: string;
};

const ROLES: Array<TeamUser['role']> = ['ORG_ADMIN', 'ACCOUNTANT', 'MANAGER', 'TECHNICIAN', 'OPERATOR'];
const PERMISSION_GROUPS: Array<{ label: string; keys: string[] }> = [
  { label: 'Buildings', keys: ['buildings.view', 'buildings.manage'] },
  { label: 'Apartments', keys: ['apartments.view', 'apartments.manage'] },
  { label: 'Residents', keys: ['residents.view', 'residents.manage'] },
  { label: 'Payments', keys: ['payments.view', 'payments.manage'] },
  { label: 'Invoices', keys: ['invoices.view', 'invoices.manage'] },
  { label: 'Reports', keys: ['reports.view'] },
  { label: 'Announcements', keys: ['announcements.view', 'announcements.manage'] },
  { label: 'Issues', keys: ['issues.view', 'issues.manage'] },
  { label: 'Suppliers', keys: ['suppliers.view', 'suppliers.manage'] },
  { label: 'Maintenance', keys: ['maintenance.view', 'maintenance.manage'] },
  { label: 'Expenses', keys: ['expenses.view', 'expenses.manage'] },
  { label: 'Settings', keys: ['settings.view', 'settings.manage'] },
  { label: 'Audit', keys: ['audit.view'] },
  { label: 'Team', keys: ['team.view', 'team.manage'] },
];

export default function TeamPage() {
  const router = useRouter();
  const params = useParams<{ locale?: string }>();
  const { user, loading } = useAuth();
  const { showToast } = useToast();
  const localeParam = typeof params?.locale === 'string' ? params.locale : defaultLocale;
  const locale = isLocale(localeParam) ? localeParam : defaultLocale;
  const userRole = (user?.role || '').toUpperCase();
  const isAdmin = userRole === 'ADMIN' || userRole === 'SUPERADMIN';
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [invitations, setInvitations] = useState<InvitationItem[]>([]);
  const [modal, setModal] = useState<'invite' | 'permissions' | null>(null);
  const [selectedMember, setSelectedMember] = useState<TeamUser | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<TeamUser['role']>('MANAGER');
  const [inviteLink, setInviteLink] = useState('');
  const [permissionsDraft, setPermissionsDraft] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!loading && !isAdmin) {
      router.replace(`/${locale}/forbidden`);
    }
  }, [isAdmin, loading, locale, router]);

  const load = async () => {
    const usersRes = await teamApi.list();
    setUsers(usersRes.data?.items ?? []);
    setInvitations(usersRes.data?.invitations ?? []);
  };

  useEffect(() => {
    if (!isAdmin) return;
    load().catch(() => undefined);
  }, [isAdmin]);

  if (!isAdmin) return null;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Organization team"
        description="Invite members, manage role permissions and access"
        rightSlot={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => {
                setModal('invite');
                setInviteEmail('');
                setInviteRole('MANAGER');
                setInviteLink('');
              }}
            >
              Invite member
            </Button>
          </div>
        }
      />

      <div className="rounded-3xl border border-border/60 bg-card/90 p-5 shadow-[0_18px_48px_-28px_rgba(109,40,217,0.45)]">
        <div className="space-y-2">
          {loading ? (
            <div className="space-y-2">
              {[...Array.from({ length: 5 })].map((_, index) => (
                <div key={index} className="h-12 animate-pulse rounded-2xl bg-muted/40" />
              ))}
            </div>
          ) : null}
          {!loading && users.length === 0 ? (
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
              <p className="text-sm text-muted-foreground">No team members yet.</p>
            </div>
          ) : null}
          {users.map((item) => (
            <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border/60 px-3 py-2">
              <div>
                <p className="text-sm font-medium text-foreground">{item.fullName || item.email}</p>
                <p className="text-xs text-muted-foreground">
                  {item.email} - {item.role} - {item.status}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  className="select text-xs"
                  value={item.role}
                  onChange={async (event) => {
                    try {
                      await teamApi.update(item.id, { role: event.target.value as TeamUser['role'] });
                      await load();
                    } catch {
                      showToast('Failed to update role', 'error');
                    }
                  }}
                >
                  {ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setSelectedMember(item);
                    setPermissionsDraft({ ...(item.permissions || {}) });
                    setModal('permissions');
                  }}
                >
                  Permissions
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    try {
                      await teamApi.disable(item.id);
                      showToast('Member disabled', 'success');
                      await load();
                    } catch {
                      showToast('Failed to disable member', 'error');
                    }
                  }}
                >
                  Disable
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-border/60 bg-card/90 p-5 shadow-[0_18px_48px_-28px_rgba(109,40,217,0.45)]">
        <h3 className="text-sm font-semibold text-foreground">Pending invitations</h3>
        <div className="mt-3 space-y-2">
          {invitations.map((invite) => {
            return (
              <div key={invite.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border/60 px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-foreground">{invite.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {invite.role} - {invite.status}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">{new Date(invite.expiresAt).toLocaleDateString()}</span>
              </div>
            );
          })}
        </div>
      </div>

      <Modal isOpen={modal === 'invite'} onClose={() => setModal(null)}>
        <ModalHeader title="Invite team member" onClose={() => setModal(null)} />
        <ModalBody className="space-y-3">
          <input className="input" placeholder="Email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} />
          <select
            className="select"
            value={inviteRole}
            onChange={(event) => setInviteRole(event.target.value as TeamUser['role'])}
          >
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
          {inviteLink ? (
            <div className="space-y-2 rounded-2xl border border-border/60 p-3">
              <input className="input" readOnly value={inviteLink} />
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  await navigator.clipboard.writeText(inviteLink);
                  showToast('Invite link copied', 'success');
                }}
              >
                Copy invite link
              </Button>
            </div>
          ) : null}
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setModal(null)}>
            Cancel
          </Button>
          <Button
            onClick={async () => {
              try {
                const res = await teamApi.invite({ email: inviteEmail.trim(), role: inviteRole });
                setInviteLink(res.data?.inviteLink || '');
                showToast('Invitation created', 'success');
                await load();
              } catch {
                showToast('Failed to create invitation', 'error');
              }
            }}
          >
            Invite
          </Button>
        </ModalFooter>
      </Modal>

      <Modal isOpen={modal === 'permissions'} onClose={() => setModal(null)}>
        <ModalHeader title="Manage permissions" onClose={() => setModal(null)} />
        <ModalBody className="space-y-3">
          {PERMISSION_GROUPS.map((group) => (
            <div key={group.label} className="rounded-2xl border border-border/60 p-3">
              <p className="mb-2 text-sm font-semibold">{group.label}</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {group.keys.map((key) => (
                  <label key={key} className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={permissionsDraft[key] === true}
                      onChange={(event) =>
                        setPermissionsDraft((prev) => ({
                          ...prev,
                          [key]: event.target.checked,
                        }))
                      }
                    />
                    {key}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setModal(null)}>
            Cancel
          </Button>
          <Button
            onClick={async () => {
              if (!selectedMember) return;
              try {
                await teamApi.updatePermissions(selectedMember.id, permissionsDraft);
                showToast('Permissions updated', 'success');
                setModal(null);
                await load();
              } catch {
                showToast('Failed to update permissions', 'error');
              }
            }}
          >
            Save
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
