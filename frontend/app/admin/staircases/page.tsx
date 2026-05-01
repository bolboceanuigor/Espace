'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { adminStructureApi } from '@/lib/api';
import MobilePageHeader from '@/components/common/MobilePageHeader';
import LoadingState from '@/components/common/LoadingState';
import EmptyState from '@/components/common/EmptyState';
import { defaultLocale, isLocale } from '@/i18n';

export default function AdminStaircasesPage() {
  const router = useRouter();
  const params = useParams<{ locale?: string }>();
  const localeParam = typeof params?.locale === 'string' ? params.locale : defaultLocale;
  const locale = isLocale(localeParam) ? localeParam : defaultLocale;
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    adminStructureApi
      .listBuildings()
      .then(async (res) => {
        if (!active) return;
        const buildings = res.data || [];
        const staircasesByBuilding = await Promise.all(
          buildings.map(async (building: any) => {
            const staircasesRes = await adminStructureApi.listStaircases(building.id);
            return (staircasesRes.data || []).map((staircase: any) => ({
              id: staircase.id,
              name: staircase.name,
              floorsCount: staircase.floorsCount,
              buildingId: building.id,
              buildingName: building.name,
            }));
          }),
        );
        if (!active) return;
        setRows(staircasesByBuilding.flat());
      })
      .catch(() => {
        if (!active) return;
        setRows([]);
        setError('Nu am putut încărca scările.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-4 pb-24 md:pb-4">
      <MobilePageHeader title="Staircases" subtitle="Manage staircases from building details." />
      {loading ? <LoadingState label="Se încarcă scările..." /> : null}
      {error ? <EmptyState title="Eroare la încărcare" description={error} /> : null}
      {!loading && !error && !rows.length ? (
        <EmptyState
          title="Nu există scări încă"
          description="Adaugă scări din pagina fiecărui bloc."
          actionLabel="Deschide Buildings"
          onAction={() => {
            router.push(`/${locale}/admin/buildings`);
          }}
        />
      ) : null}
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.id} className="rounded-xl border border-border/70 bg-card p-3 shadow-sm">
            <p className="font-medium text-foreground">
              {row.name} - {row.buildingName}
            </p>
            <p className="text-xs text-muted-foreground">Floors: {row.floorsCount || 0}</p>
            <Link href={`/${locale}/admin/buildings/${row.buildingId}`} className="mt-2 inline-block text-sm text-primary hover:underline">
              Open building details
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
