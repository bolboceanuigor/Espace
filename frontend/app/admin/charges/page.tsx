'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminStructureApi, reportsApi } from '@/lib/api';
import MobilePageHeader from '@/components/common/MobilePageHeader';
import LoadingState from '@/components/common/LoadingState';
import EmptyState from '@/components/common/EmptyState';
import Button from '@/components/ui/Button';
import StatusBadge from '@/components/ui/StatusBadge';
import { useToast } from '@/components/ui/ToastProvider';
import { useLocalizedPath } from '@/lib/use-localized-path';

export default function AdminChargesPage() {
  const { showToast } = useToast();
  const localizedPath = useLocalizedPath();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [status, setStatus] = useState('');
  const [apartmentSearch, setApartmentSearch] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [apartmentsCount, setApartmentsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [chargesRes, apartmentsRes] = await Promise.all([
        reportsApi.adminCharges({ month, year }),
        adminStructureApi.listApartments(),
      ]);
      setRows(chargesRes.data || []);
      const apartments = Array.isArray(apartmentsRes.data) ? apartmentsRes.data : (apartmentsRes.data as any)?.data || [];
      setApartmentsCount(apartments.length);
    } catch {
      setRows([]);
      setError('Nu am putut încărca lista de taxe lunare.');
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        if (status && String(row.status || '').toUpperCase() !== status) return false;
        if (apartmentSearch && !String(row.apartment || '').toLowerCase().includes(apartmentSearch.toLowerCase().trim())) return false;
        return true;
      }),
    [apartmentSearch, rows, status],
  );

  return (
    <div className="space-y-4 pb-24 md:pb-4">
      <MobilePageHeader title="Taxe lunare" subtitle="Verifică taxele calculate și creează facturile din fluxul de drafturi." />

      {loading ? <LoadingState label="Se încarcă taxele..." /> : null}
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
          <Button className="ml-2" size="sm" variant="secondary" onClick={() => load()}>
            Reîncearcă
          </Button>
        </div>
      ) : null}

      <div className="rounded-xl border border-border/70 bg-card p-4">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
          <input className="input" type="number" min={1} max={12} value={month} onChange={(e) => setMonth(Number(e.target.value))} />
          <input className="input" type="number" min={2000} value={year} onChange={(e) => setYear(Number(e.target.value))} />
          <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Toate statusurile</option>
            <option value="PAID">Achitate</option>
            <option value="UNPAID_PARTIAL">Neachitate/parțiale</option>
          </select>
          <input
            className="input md:col-span-2"
            placeholder="Filtrează după apartament"
            value={apartmentSearch}
            onChange={(e) => setApartmentSearch(e.target.value)}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            variant="secondary"
            isLoading={generating}
            disabled={generating}
            onClick={async () => {
              if (month < 1 || month > 12 || year < 2000 || year > 2100) {
                showToast('Perioada selectată este invalidă.', 'error');
                return;
              }
              setGenerating(true);
              showToast('Generarea legacy este dezactivată. Deschidem fluxul de drafturi.');
              window.location.assign(localizedPath('/admin/billing-drafts?tab=invoices'));
            }}
          >
            Deschide drafturi facturi
          </Button>
          <p className="text-xs text-muted-foreground">
            Apartamente în organizație: {apartmentsCount}. Facturile pilot se creează doar prin drafturi și publicare internă.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {filteredRows.map((row, index) => (
          <div key={`${row.apartment}-${row.tariffName}-${index}`} className="rounded-xl border border-border/70 bg-card p-3 shadow-sm">
            <p className="font-medium text-foreground">Ap. #{row.apartment}</p>
            <p className="text-xs text-muted-foreground">
              {row.tariffName} • {row.amount} {row.currency}
            </p>
            <div className="mt-2">
              <StatusBadge status={row.status === 'PAID' ? 'PAID' : 'PARTIAL'} />
            </div>
          </div>
        ))}
        {!loading && !filteredRows.length ? (
          <EmptyState title="Nu există taxe generate" description="Generează taxele pentru luna selectată sau modifică filtrele." />
        ) : null}
      </div>
    </div>
  );
}
