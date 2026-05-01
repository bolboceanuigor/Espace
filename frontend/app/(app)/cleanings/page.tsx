'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { PageHeader, useToast } from '@/components/ui';
import { Button } from '@/components/ui';
import { cleaningsApi, exportsApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { formatDate } from '@/lib/formatDate';
import { addDays, toDateOnlyString } from '@/lib/date';

type CleaningItem = {
  id: string;
  propertyId: string;
  reservationId?: string | null;
  propertyName: string;
  guestName: string;
  date: string;
  status: 'TODO' | 'DONE' | 'CANCELLED';
  assignedToId?: string | null;
  notes?: string | null;
};

export default function CleaningsPage() {
  const locale = useLocale();
  const tPages = useTranslations('pages.cleanings');
  const tStatus = useTranslations('status');
  const tActions = useTranslations('actions');
  const c = useTranslations('common');
  const { user } = useAuth();
  const { showToast } = useToast();
  const normalizedRole = (user?.role || '').toUpperCase();
  const isAdmin = normalizedRole === 'ADMIN' || normalizedRole === 'SUPERADMIN';
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<CleaningItem[]>([]);

  const downloadCsv = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  const load = async () => {
    setLoading(true);
    try {
      const start = toDateOnlyString(new Date());
      const end = addDays(start, 7);
      const response = await cleaningsApi.getAll({ start, end });
      setItems(response.data ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const grouped = useMemo(() => {
    return items.reduce<Record<string, CleaningItem[]>>((acc, item) => {
      if (!acc[item.date]) acc[item.date] = [];
      acc[item.date].push(item);
      return acc;
    }, {});
  }, [items]);

  const toggleDone = async (item: CleaningItem) => {
    if (item.status === 'CANCELLED') {
      showToast(c('error'), 'error');
      return;
    }
    const nextStatus = item.status === 'DONE' ? 'TODO' : 'DONE';
    try {
      await cleaningsApi.update(item.id, { status: nextStatus });
      await load();
      showToast(c('saved'), 'success');
    } catch {
      showToast(c('error'), 'error');
    }
  };

  const handleExport = async () => {
    try {
      const start = toDateOnlyString(new Date());
      const end = addDays(start, 7);
      const res = await exportsApi.exportCleanings(start, end);
      downloadCsv(res.data, 'cleanings.csv');
      showToast(c('saved'), 'success');
    } catch {
      showToast(c('error'), 'error');
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={tPages('title')}
        description={tPages('desc')}
        rightSlot={
          isAdmin ? (
            <Button size="sm" variant="secondary" onClick={handleExport}>
              {tActions('export')}
            </Button>
          ) : null
        }
      />
      <div className="rounded-3xl border border-border/60 bg-card/90 p-5 shadow-[0_18px_48px_-28px_rgba(109,40,217,0.45)]">
        {loading ? (
          <div className="space-y-2">
            {[...Array.from({ length: 5 })].map((_, index) => (
              <div key={index} className="h-12 animate-pulse rounded-xl bg-muted/40" />
            ))}
          </div>
        ) : null}
        {!loading && items.length === 0 ? (
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
            <p className="text-sm text-muted-foreground">{c('noCleaningsScheduled')}</p>
            {isAdmin ? (
              <Button
                size="sm"
                className="mt-3"
                onClick={() => showToast(c('manualCleaningSoon'), 'success')}
              >
                {c('createManualCleaning')}
              </Button>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-4">
          {Object.entries(grouped).map(([date, dayItems]) => (
            <div key={date} className="rounded-2xl border border-border/60">
              <div className="border-b border-border/60 px-3 py-2 text-sm font-medium text-foreground">
                {date ? formatDate(locale, new Date(`${date}T12:00:00`)) : '-'}
              </div>
              <div className="space-y-2 p-2">
                {dayItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-2xl border border-border/60 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.guestName}</p>
                      <p className="text-xs text-muted-foreground">{item.propertyName}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleDone(item)}
                      className="h-9 rounded-xl border border-border/60 px-3 text-sm text-foreground transition duration-150 ease-out hover:bg-muted/60"
                    >
                      {item.status === 'DONE' ? tActions('cancel') : tActions('save')} ({tStatus(item.status)})
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
