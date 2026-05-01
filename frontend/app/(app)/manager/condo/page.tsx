'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { condoApi } from '@/lib/api';
import { Button, PageHeader, useToast } from '@/components/ui';

type Summary = Awaited<ReturnType<typeof condoApi.listAnnualSummaries>>['data'][number];
type Announcement = Awaited<ReturnType<typeof condoApi.listAnnouncements>>['data'][number];

const currentYear = new Date().getFullYear();

export default function ManagerCondoPage() {
  const tCommon = useTranslations('common');
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    year: currentYear - 1,
    adminName: 'Administrator',
    totalBudgetMdl: '0',
    totalExpensesMdl: '0',
    repairFundMdl: '0',
    debtTotalMdl: '0',
    notes: '',
  });
  const [announceForm, setAnnounceForm] = useState({
    title: '',
    body: '',
    visibility: 'OWNERS' as 'OWNERS' | 'ALL',
  });

  const load = async () => {
    setLoading(true);
    try {
      const [summaryRes, annRes] = await Promise.all([
        condoApi.listAnnualSummaries(),
        condoApi.listAnnouncements(),
      ]);
      setSummaries(summaryRes.data || []);
      setAnnouncements(annRes.data || []);
    } catch {
      showToast(tCommon('error'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Administrare condominiu"
        description="Fisa de sinteza anuala, anunturi pentru proprietari si transparenta."
      />

      <div className="rounded-3xl border border-border/60 bg-card/90 p-5 shadow-[0_18px_48px_-28px_rgba(109,40,217,0.45)]">
        <h2 className="text-sm font-semibold text-foreground">Fisa de sinteza anuala</h2>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <input className="input" type="number" value={form.year} onChange={(e) => setForm((p) => ({ ...p, year: Number(e.target.value) }))} placeholder="An" />
          <input className="input" value={form.adminName} onChange={(e) => setForm((p) => ({ ...p, adminName: e.target.value }))} placeholder="Nume administrator" />
          <input className="input" type="number" value={form.totalBudgetMdl} onChange={(e) => setForm((p) => ({ ...p, totalBudgetMdl: e.target.value }))} placeholder="Buget total MDL" />
          <input className="input" type="number" value={form.totalExpensesMdl} onChange={(e) => setForm((p) => ({ ...p, totalExpensesMdl: e.target.value }))} placeholder="Cheltuieli MDL" />
          <input className="input" type="number" value={form.repairFundMdl} onChange={(e) => setForm((p) => ({ ...p, repairFundMdl: e.target.value }))} placeholder="Fond reparatii MDL" />
          <input className="input" type="number" value={form.debtTotalMdl} onChange={(e) => setForm((p) => ({ ...p, debtTotalMdl: e.target.value }))} placeholder="Datorii totale MDL" />
        </div>
        <textarea className="input mt-2 min-h-[84px]" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Note pentru proprietari" />
        <div className="mt-3">
          <Button
            size="sm"
            onClick={async () => {
              setSaving(true);
              try {
                await condoApi.createAnnualSummary({
                  year: Number(form.year),
                  adminName: form.adminName.trim(),
                  totalBudgetMdl: Number(form.totalBudgetMdl || 0),
                  totalExpensesMdl: Number(form.totalExpensesMdl || 0),
                  repairFundMdl: Number(form.repairFundMdl || 0),
                  debtTotalMdl: Number(form.debtTotalMdl || 0),
                  notes: form.notes.trim() || undefined,
                });
                showToast('Fisa salvata', 'success');
                await load();
              } catch {
                showToast(tCommon('error'), 'error');
              } finally {
                setSaving(false);
              }
            }}
            disabled={saving}
          >
            Salveaza fisa
          </Button>
        </div>
        <div className="mt-4 space-y-2">
          {loading ? <p className="text-sm text-muted-foreground">{tCommon('loading')}</p> : null}
          {summaries.map((item) => (
            <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border/60 px-3 py-2">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {item.year} · {item.status}
                </p>
                <p className="text-xs text-muted-foreground">
                  Buget {item.totalBudgetMdl} MDL · Cheltuieli {item.totalExpensesMdl} MDL · Datorii {item.debtTotalMdl} MDL
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  try {
                    await condoApi.publishAnnualSummary(item.id);
                    showToast('Fisa publicata', 'success');
                    await load();
                  } catch {
                    showToast(tCommon('error'), 'error');
                  }
                }}
                disabled={item.status === 'PUBLISHED'}
              >
                Publica
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-border/60 bg-card/90 p-5 shadow-[0_18px_48px_-28px_rgba(109,40,217,0.45)]">
        <h2 className="text-sm font-semibold text-foreground">Anunturi catre proprietari</h2>
        <div className="mt-3 space-y-2">
          <input className="input" value={announceForm.title} onChange={(e) => setAnnounceForm((p) => ({ ...p, title: e.target.value }))} placeholder="Titlu anunt" />
          <textarea className="input min-h-[88px]" value={announceForm.body} onChange={(e) => setAnnounceForm((p) => ({ ...p, body: e.target.value }))} placeholder="Mesaj anunt" />
          <select className="select" value={announceForm.visibility} onChange={(e) => setAnnounceForm((p) => ({ ...p, visibility: e.target.value as 'OWNERS' | 'ALL' }))}>
            <option value="OWNERS">OWNERS</option>
            <option value="ALL">ALL</option>
          </select>
          <Button
            size="sm"
            onClick={async () => {
              try {
                await condoApi.createAnnouncement({
                  title: announceForm.title.trim(),
                  body: announceForm.body.trim(),
                  visibility: announceForm.visibility,
                });
                setAnnounceForm({ title: '', body: '', visibility: 'OWNERS' });
                showToast('Anunt publicat', 'success');
                await load();
              } catch {
                showToast(tCommon('error'), 'error');
              }
            }}
          >
            Publica anunt
          </Button>
        </div>
        <div className="mt-4 space-y-2">
          {announcements.map((item) => (
            <div key={item.id} className="rounded-2xl border border-border/60 p-3">
              <p className="text-sm font-medium text-foreground">{item.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
