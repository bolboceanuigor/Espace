'use client';

import { useEffect, useState } from 'react';
import { useParams, usePathname } from 'next/navigation';
import { billingSaasApi, superadminApi } from '@/lib/api';
import Link from 'next/link';

export default function SuperadminOrganizationSubscriptionPage() {
  const params = useParams<{ id: string }>();
  const pathname = usePathname();
  const orgId = params?.id;
  const [all, setAll] = useState<any[]>([]);
  const [row, setRow] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'subscription' | 'notes'>(pathname?.endsWith('/notes') ? 'notes' : 'subscription');
  const [noteTypeFilter, setNoteTypeFilter] = useState('');
  const [notes, setNotes] = useState<any[]>([]);
  const [form, setForm] = useState({
    billingType: 'PER_APARTMENT' as 'PER_APARTMENT' | 'PER_M2' | 'FIXED',
    price: 1,
    currency: 'MDL' as 'MDL' | 'EUR' | 'USD',
    trialStartDate: '',
    trialEndDate: '',
    nextBillingDate: '',
    status: 'TRIAL' as 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELLED',
    notes: '',
  });
  const [betaAccessEnabled, setBetaAccessEnabled] = useState(false);
  const [demoModeEnabled, setDemoModeEnabled] = useState(false);
  const [noteDraft, setNoteDraft] = useState({
    type: 'OTHER' as 'CALL' | 'MEETING' | 'SUPPORT' | 'SALES' | 'BILLING' | 'OTHER',
    title: '',
    content: '',
    followUpAt: '',
    isImportant: false,
  });

  const load = async () => {
    const [tableRes, detailsRes] = await Promise.all([
      billingSaasApi.listSuperadminSubscriptions(),
      billingSaasApi.getOrganizationSubscription(orgId!),
    ]);
    const data = tableRes.data || [];
    setAll(data);
    const found = data.find((item) => item.organizationId === orgId) || null;
    const orgEntry = (await superadminApi.listOrgs()).data?.find((item: any) => item.id === orgId);
    const details = detailsRes.data?.subscription || null;
    const notesRes = await superadminApi.listOrganizationNotes(orgId!, {
      type: (noteTypeFilter || undefined) as any,
    });
    setNotes(notesRes.data || []);
    setRow({
      ...found,
      invoices: details?.invoices || [],
      id: details?.id || found?.id,
      notes: details?.notes || '',
      trialStartDate: details?.trialStartDate || found?.trialStartDate,
      trialEndDate: details?.trialEndDate || found?.trialEndDate,
      nextBillingDate: details?.nextBillingDate || found?.nextBillingDate,
      billingType: details?.billingType || found?.billingType,
      price: details?.price ?? found?.price,
      currency: details?.currency || found?.currency,
      status: details?.status || found?.status,
      betaAccessEnabled: orgEntry?.betaAccessEnabled ?? false,
    });
    setBetaAccessEnabled(Boolean(orgEntry?.betaAccessEnabled));
    setDemoModeEnabled(Boolean(orgEntry?.isDemo));
    if (details || found) {
      const source = details || found;
      setForm({
        billingType: source.billingType,
        price: Number(source.price || 0),
        currency: source.currency,
        trialStartDate: source.trialStartDate ? String(source.trialStartDate).slice(0, 10) : '',
        trialEndDate: source.trialEndDate ? String(source.trialEndDate).slice(0, 10) : '',
        nextBillingDate: source.nextBillingDate ? String(source.nextBillingDate).slice(0, 10) : '',
        status: source.status,
        notes: source.notes || '',
      });
    }
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, [orgId, noteTypeFilter]);

  useEffect(() => {
    if (pathname?.endsWith('/notes')) setActiveTab('notes');
  }, [pathname]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-foreground">Organization Subscription</h1>
      <p className="text-sm text-muted-foreground">Organization: {row?.organizationName || orgId}</p>
      <div className="flex items-center gap-2">
        <button
          className={`rounded-md border px-3 py-1.5 text-xs ${activeTab === 'subscription' ? 'border-primary bg-primary text-white' : 'border-border/70'}`}
          onClick={() => setActiveTab('subscription')}
        >
          Subscription
        </button>
        <button
          className={`rounded-md border px-3 py-1.5 text-xs ${activeTab === 'notes' ? 'border-primary bg-primary text-white' : 'border-border/70'}`}
          onClick={() => setActiveTab('notes')}
        >
          Notes
        </button>
      </div>
      {activeTab === 'subscription' ? (
        <>
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
        <p className="text-xs text-amber-700">Support mode lets you troubleshoot this organization without sharing admin credentials.</p>
        <div className="mt-2 flex items-center gap-2">
          <button
            className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs"
            onClick={async () => {
              await superadminApi.startSupportSession(orgId!, 'Support from organization subscription page');
            }}
          >
            Enter support mode
          </button>
          <Link href={`/superadmin/organizations/${orgId}/backup`} className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs">
            Organization backup
          </Link>
          <Link href={`/superadmin/organizations/${orgId}/limits`} className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs">
            Usage limits
          </Link>
          <label className="ml-2 inline-flex items-center gap-2 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs">
            <input
              type="checkbox"
              checked={betaAccessEnabled}
              onChange={async (event) => {
                const value = event.target.checked;
                setBetaAccessEnabled(value);
                await superadminApi.updateOrg(orgId!, { betaAccessEnabled: value });
              }}
            />
            Beta access enabled
          </label>
          <label className="inline-flex items-center gap-2 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs">
            <input
              type="checkbox"
              checked={demoModeEnabled}
              onChange={async (event) => {
                const value = event.target.checked;
                setDemoModeEnabled(value);
                await superadminApi.updateOrg(orgId!, { isDemo: value });
              }}
            />
            Demo mode organization
          </label>
        </div>
      </div>

      <div className="rounded-xl border border-border/70 bg-card p-4">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
          <select className="select" value={form.billingType} onChange={(e) => setForm((p) => ({ ...p, billingType: e.target.value as any }))}>
            <option value="PER_APARTMENT">PER_APARTMENT</option>
            <option value="PER_M2">PER_M2</option>
            <option value="FIXED">FIXED</option>
          </select>
          <input className="input" type="number" value={form.price} onChange={(e) => setForm((p) => ({ ...p, price: Number(e.target.value) }))} />
          <select className="select" value={form.currency} onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value as any }))}>
            <option value="MDL">MDL</option>
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
          </select>
          <select className="select" value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as any }))}>
            <option value="TRIAL">TRIAL</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="PAST_DUE">PAST_DUE</option>
            <option value="SUSPENDED">SUSPENDED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
          <input className="input" type="date" value={form.trialStartDate} onChange={(e) => setForm((p) => ({ ...p, trialStartDate: e.target.value }))} />
          <input className="input" type="date" value={form.trialEndDate} onChange={(e) => setForm((p) => ({ ...p, trialEndDate: e.target.value }))} />
          <input className="input" type="date" value={form.nextBillingDate} onChange={(e) => setForm((p) => ({ ...p, nextBillingDate: e.target.value }))} />
          <input className="input" placeholder="Notes" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button
            className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white"
            onClick={async () => {
              await billingSaasApi.upsertOrganizationSubscription(orgId!, {
                billingType: form.billingType,
                price: form.price,
                currency: form.currency,
                trialStartDate: form.trialStartDate || null,
                trialEndDate: form.trialEndDate || null,
                nextBillingDate: form.nextBillingDate || null,
                status: form.status,
                notes: form.notes || null,
              });
              await load();
            }}
          >
            Save
          </button>
          {row?.id ? (
            <button
              className="rounded-lg border border-border/70 px-3 py-2 text-sm"
              onClick={async () => {
                await billingSaasApi.generateInvoice(row.id);
                await load();
              }}
            >
              Generate invoice
            </button>
          ) : null}
        </div>
      </div>
        </>
      ) : null}

      {activeTab === 'subscription' ? (
        <div className="rounded-xl border border-border/70 bg-card p-4">
          <p className="mb-2 text-sm font-medium text-foreground">Invoices</p>
          <div className="space-y-2">
            {(row?.invoices || []).map((invoice: any) => (
              <div key={invoice.id} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
                <span className="text-sm text-foreground">
                  {invoice.amount} {invoice.currency} - {invoice.status}
                </span>
                {invoice.status !== 'PAID' ? (
                  <button
                    className="text-sm text-primary"
                    onClick={async () => {
                      await billingSaasApi.markInvoicePaid(invoice.id);
                      await load();
                    }}
                  >
                    Mark paid
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-xl border border-border/70 bg-card p-4">
            <p className="mb-2 text-sm font-medium text-foreground">Add note</p>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
              <select className="select" value={noteDraft.type} onChange={(e) => setNoteDraft((p) => ({ ...p, type: e.target.value as any }))}>
                <option value="CALL">CALL</option>
                <option value="MEETING">MEETING</option>
                <option value="SUPPORT">SUPPORT</option>
                <option value="SALES">SALES</option>
                <option value="BILLING">BILLING</option>
                <option value="OTHER">OTHER</option>
              </select>
              <input className="input" placeholder="Title" value={noteDraft.title} onChange={(e) => setNoteDraft((p) => ({ ...p, title: e.target.value }))} />
              <input type="datetime-local" className="input" value={noteDraft.followUpAt} onChange={(e) => setNoteDraft((p) => ({ ...p, followUpAt: e.target.value }))} />
              <label className="inline-flex items-center gap-2 rounded-md border border-border/70 px-3 py-2 text-xs">
                <input type="checkbox" checked={noteDraft.isImportant} onChange={(e) => setNoteDraft((p) => ({ ...p, isImportant: e.target.checked }))} />
                Important
              </label>
              <textarea className="min-h-[100px] rounded-md border border-border bg-background p-3 text-sm md:col-span-4" placeholder="Content" value={noteDraft.content} onChange={(e) => setNoteDraft((p) => ({ ...p, content: e.target.value }))} />
            </div>
            <button
              className="mt-2 rounded-md bg-primary px-3 py-2 text-xs text-primary-foreground"
              onClick={async () => {
                if (!noteDraft.title.trim() || !noteDraft.content.trim()) return;
                await superadminApi.createOrganizationNote(orgId!, {
                  type: noteDraft.type,
                  title: noteDraft.title.trim(),
                  content: noteDraft.content.trim(),
                  followUpAt: noteDraft.followUpAt ? new Date(noteDraft.followUpAt).toISOString() : undefined,
                  isImportant: noteDraft.isImportant,
                });
                setNoteDraft({ type: 'OTHER', title: '', content: '', followUpAt: '', isImportant: false });
                await load();
              }}
            >
              Save note
            </button>
          </div>

          <div className="rounded-xl border border-border/70 bg-card p-4">
            <div className="mb-2 flex items-center gap-2">
              <p className="text-sm font-medium text-foreground">Notes timeline</p>
              <select className="select h-8 w-40" value={noteTypeFilter} onChange={(e) => setNoteTypeFilter(e.target.value)}>
                <option value="">All types</option>
                <option value="CALL">CALL</option>
                <option value="MEETING">MEETING</option>
                <option value="SUPPORT">SUPPORT</option>
                <option value="SALES">SALES</option>
                <option value="BILLING">BILLING</option>
                <option value="OTHER">OTHER</option>
              </select>
            </div>
            <div className="space-y-2">
              {notes.map((note) => (
                <div key={note.id} className="rounded-lg border border-border/60 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md border border-border/70 px-2 py-0.5 text-xs">{note.type}</span>
                    {note.isImportant ? <span className="rounded-md border border-amber-300 bg-amber-100 px-2 py-0.5 text-xs text-amber-700">Important</span> : null}
                    <span className="text-xs text-muted-foreground">{new Date(note.createdAt).toLocaleString()}</span>
                    {note.followUpAt ? (
                      <span className="text-xs text-primary">
                        Follow-up: {new Date(note.followUpAt).toLocaleString()}
                      </span>
                    ) : null}
                    {note.followUpDone ? (
                      <span className="rounded-md border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                        Follow-up done
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm font-medium text-foreground">{note.title}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{note.content}</p>
                  <p className="mt-1 text-xs text-muted-foreground">by {note.createdByUser?.firstName || note.createdByUser?.email || '-'}</p>
                  <div className="mt-2 flex gap-2">
                    {note.followUpAt && !note.followUpDone ? (
                      <button
                        className="rounded border px-2 py-1 text-xs"
                        onClick={async () => {
                          await superadminApi.markClientNoteFollowUpDone(note.id);
                          await load();
                        }}
                      >
                        Mark follow-up done
                      </button>
                    ) : null}
                    <button className="rounded border px-2 py-1 text-xs" onClick={async () => { await superadminApi.updateClientNote(note.id, { isImportant: !note.isImportant }); await load(); }}>
                      {note.isImportant ? 'Unmark important' : 'Mark important'}
                    </button>
                    <button className="rounded border px-2 py-1 text-xs" onClick={async () => { await superadminApi.deleteClientNote(note.id); await load(); }}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
              {!notes.length ? <p className="text-sm text-muted-foreground">No notes yet.</p> : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
