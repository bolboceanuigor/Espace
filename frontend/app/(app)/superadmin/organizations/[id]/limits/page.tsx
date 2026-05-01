'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { limitsApi } from '@/lib/api';

const MODULE_KEYS = [
  'payments',
  'invoices',
  'reports',
  'issues',
  'voting',
  'documents',
  'imports',
  'reconciliation',
  'cameras',
  'integrations',
] as const;

export default function SuperadminOrganizationLimitsPage() {
  const params = useParams<{ id: string }>();
  const organizationId = params?.id;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<any>({
    maxApartments: '',
    maxBuildings: '',
    maxTeamMembers: '',
    maxResidents: '',
    maxStorageMb: '',
    modulesJson: {},
  });

  const normalizedModules = useMemo(
    () =>
      MODULE_KEYS.reduce<Record<string, boolean>>((acc, key) => {
        acc[key] = Boolean(draft.modulesJson?.[key]);
        return acc;
      }, {}),
    [draft.modulesJson],
  );

  useEffect(() => {
    if (!organizationId) return;
    let active = true;
    limitsApi
      .superadminGetOrganizationLimits(organizationId)
      .then((res) => {
        if (!active) return;
        setDraft({
          maxApartments: res.data?.maxApartments ?? '',
          maxBuildings: res.data?.maxBuildings ?? '',
          maxTeamMembers: res.data?.maxTeamMembers ?? '',
          maxResidents: res.data?.maxResidents ?? '',
          maxStorageMb: res.data?.maxStorageMb ?? '',
          modulesJson: res.data?.modulesJson || {},
        });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [organizationId]);

  if (loading) return <div className="text-sm text-muted-foreground">Loading limits...</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-foreground">Organization limits</h1>
      <div className="grid gap-3 md:grid-cols-2 rounded-xl border border-border/70 bg-card p-4">
        {[
          ['maxApartments', 'Max apartments'],
          ['maxBuildings', 'Max buildings'],
          ['maxTeamMembers', 'Max team members'],
          ['maxResidents', 'Max residents'],
          ['maxStorageMb', 'Max storage MB'],
        ].map(([field, label]) => (
          <div key={field} className="space-y-1">
            <p className="text-xs text-muted-foreground">{label}</p>
            <input
              value={draft[field]}
              onChange={(e) => setDraft((prev: any) => ({ ...prev, [field]: e.target.value }))}
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              placeholder="Unlimited if empty"
            />
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border/70 bg-card p-4">
        <p className="mb-3 text-sm font-medium">Modules</p>
        <div className="grid gap-2 md:grid-cols-2">
          {MODULE_KEYS.map((key) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={normalizedModules[key]}
                onChange={(e) =>
                  setDraft((prev: any) => ({
                    ...prev,
                    modulesJson: { ...(prev.modulesJson || {}), [key]: e.target.checked },
                  }))
                }
              />
              {key}
            </label>
          ))}
        </div>
      </div>

      <button
        className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground"
        onClick={async () => {
          setSaving(true);
          try {
            await limitsApi.superadminUpdateOrganizationLimits(organizationId, {
              maxApartments: draft.maxApartments === '' ? null : Number(draft.maxApartments),
              maxBuildings: draft.maxBuildings === '' ? null : Number(draft.maxBuildings),
              maxTeamMembers: draft.maxTeamMembers === '' ? null : Number(draft.maxTeamMembers),
              maxResidents: draft.maxResidents === '' ? null : Number(draft.maxResidents),
              maxStorageMb: draft.maxStorageMb === '' ? null : Number(draft.maxStorageMb),
              modulesJson: normalizedModules,
            });
          } finally {
            setSaving(false);
          }
        }}
      >
        {saving ? 'Saving...' : 'Save limits'}
      </button>
    </div>
  );
}

