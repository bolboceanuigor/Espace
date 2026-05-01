'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CreditCard, Home, Megaphone, MessageCircle } from 'lucide-react';
import { communicationsApi, invoicesApi, issuesApi, reportsApi, supportChatApi } from '@/lib/api';
import EmptyState from '@/components/common/EmptyState';
import LoadingState from '@/components/common/LoadingState';
import StatusBadge from '@/components/ui/StatusBadge';

type ResidentDashboardPayload = {
  apartments?: Array<{
    apartmentId: string;
    isPrimary: boolean;
    type: string;
    apartment: { number: string; building: { name: string }; staircase: { name: string } };
  }>;
  selectedApartmentId?: string | null;
  apartmentNumber?: string | null;
  currentDebt?: number;
  myIssues?: Array<{ id: string; title: string; status: string }>;
  announcements?: Array<{ id: string; title: string; content: string; isPinned?: boolean; importance?: string }>;
  unreadMessages?: number;
};

export default function ResidentDashboardPage() {
  const APARTMENT_KEY = 'resident.dashboard.apartmentId';
  const [data, setData] = useState<ResidentDashboardPayload | null>(null);
  const [latestInvoice, setLatestInvoice] = useState<any | null>(null);
  const [selectedApartmentId, setSelectedApartmentId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async (apartmentId?: string) => {
    setError(null);
    try {
      const [statementRes, invoicesRes, announcementsRes, issuesRes, supportConversationsRes, communityConversationsRes] = await Promise.all([
        reportsApi.residentStatement(apartmentId ? { apartmentId } : undefined),
        invoicesApi.residentList(),
        communicationsApi.listResidentAnnouncements(),
        issuesApi.residentList(),
        supportChatApi.residentListConversations(),
        supportChatApi.residentListCommunity(),
      ]);
      const statement = statementRes.data || {};
      const invoices = invoicesRes.data || [];
      const apartments = statement.apartments || [];
      const preferredApartment = typeof window !== 'undefined' ? localStorage.getItem(APARTMENT_KEY) || '' : '';
      const currentApartmentId = apartmentId || preferredApartment || apartments[0]?.apartmentId || '';
      setData({
        apartments,
        selectedApartmentId: currentApartmentId,
        apartmentNumber: (apartments.find((a: any) => a.apartmentId === currentApartmentId) || apartments[0])?.apartment?.number || null,
        currentDebt: Number(statement.totals?.totalDebt || 0),
        myIssues: (issuesRes.data || []).filter((item: any) => ['NEW', 'IN_PROGRESS', 'WAITING'].includes(String(item.status || '').toUpperCase())),
        announcements: (announcementsRes.data || []).sort((a: any, b: any) => Number(b.isPinned || false) - Number(a.isPinned || false)),
        unreadMessages:
          (supportConversationsRes.data || []).filter((c: any) => c.status !== 'CLOSED').length +
          (communityConversationsRes.data || []).length,
      });
      setSelectedApartmentId(currentApartmentId);
      if (typeof window !== 'undefined' && currentApartmentId) {
        localStorage.setItem(APARTMENT_KEY, currentApartmentId);
      }
      setLatestInvoice(invoices[0] || null);
    } catch {
      setError('Nu am putut încărca dashboard-ul rezidentului.');
      setData(null);
    }
  };

  useEffect(() => {
    let active = true;
    load()
      .then(() => undefined)
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) return <LoadingState label="Se încarcă dashboard-ul..." />;
  if (error) {
    return (
      <div className="space-y-4 pb-24 md:pb-4">
        <section className="rounded-[1.75rem] border border-border/70 bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
          <p className="inline-flex rounded-full border border-border/70 bg-muted/60 px-3 py-1 text-xs font-semibold text-muted-foreground">Acasă</p>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">Ecranul principal al apartamentului tău</h1>
        </section>
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}{' '}
          <button className="underline" onClick={() => load(selectedApartmentId).catch(() => undefined)}>
            Reîncearcă
          </button>
        </div>
      </div>
    );
  }
  if (!data?.apartments?.length) {
    return <EmptyState title="Nu ai apartamente încă" description="Administratorul va adăuga apartamentul tău și vei vedea aici datoriile și facturile." />;
  }

  return (
    <div className="space-y-5 overflow-x-hidden pb-24 md:space-y-6 md:pb-4">
      <section className="rounded-[1.75rem] border border-border/70 bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] md:p-7">
        <p className="inline-flex rounded-full border border-border/70 bg-muted/60 px-3 py-1 text-xs font-semibold text-muted-foreground">Acasă</p>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground md:text-4xl">Ecranul principal al locuinței tale</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
          Facturi, anunțuri și mesaje importante, într-un spațiu simplu de urmărit.
        </p>
      </section>
      {data.apartments.length > 1 ? (
        <select
          className="select w-full"
          value={selectedApartmentId}
          onChange={async (event) => {
            const nextApartmentId = event.target.value;
            setSelectedApartmentId(nextApartmentId);
            if (typeof window !== 'undefined') localStorage.setItem(APARTMENT_KEY, nextApartmentId);
            await load(nextApartmentId);
          }}
        >
          {data.apartments.map((entry) => (
            <option key={entry.apartmentId} value={entry.apartmentId}>
              {entry.apartment.building?.name} / {entry.apartment.staircase?.name} / #{entry.apartment.number}
            </option>
          ))}
        </select>
      ) : null}
      <section className="grid gap-3 md:grid-cols-4">
        {[
          { label: 'Datorie curentă', value: `${Number(data?.currentDebt || 0).toFixed(2)} MDL`, icon: CreditCard, href: '/resident/payments' },
          { label: 'Apartament', value: `#${data?.apartmentNumber || '-'}`, icon: Home, href: '/resident/account' },
          { label: 'Anunțuri active', value: String(data?.announcements?.length || 0), icon: Megaphone, href: '/resident/announcements' },
          { label: 'Mesaje necitite', value: String(Number((data as any)?.unreadMessages || 0)), icon: MessageCircle, href: '/resident/chat' },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.label} href={item.href} className="rounded-[1.35rem] border border-border/70 bg-white/90 p-4 shadow-[0_14px_40px_rgba(15,23,42,0.045)] transition hover:-translate-y-0.5 hover:border-foreground/15">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">{item.label}</p>
                  <p className="mt-2 text-xl font-semibold text-foreground">{item.value}</p>
                </div>
                <span className="rounded-2xl bg-muted p-2 text-foreground">
                  <Icon className="h-5 w-5" />
                </span>
              </div>
            </Link>
          );
        })}
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-[1.35rem] border border-border/70 bg-white/90 p-4 shadow-[0_14px_40px_rgba(15,23,42,0.045)]">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground">Ultima factura</p>
            <Link href="/resident/invoices" className="text-xs text-primary">Vezi toate</Link>
          </div>
          {latestInvoice ? (
            <>
              <p className="mt-2 text-sm text-foreground">{latestInvoice.invoiceNumber}</p>
              <p className="text-xs text-muted-foreground">{latestInvoice.month}/{latestInvoice.year} • {latestInvoice.totalDue} MDL • {latestInvoice.status}</p>
            </>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">Nu exista facturi disponibile.</p>
          )}
        </div>

        <div className="rounded-[1.35rem] border border-border/70 bg-white/90 p-4 shadow-[0_14px_40px_rgba(15,23,42,0.045)]">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground">Ultimele postări Avizier</p>
            <Link href="/resident/announcements" className="text-xs text-primary">Vezi</Link>
          </div>
          <div className="mt-2 space-y-2">
            {(data?.announcements || []).slice(0, 3).map((item: any) => (
              <div key={item.id} className="rounded-2xl border border-border/60 bg-background/60 p-3">
                <p className="text-sm font-medium text-foreground">
                  {item.title} {item.isPinned ? '• PINNED' : ''} {item.importance === 'URGENT' ? '• URGENT' : ''}
                </p>
                <p className="line-clamp-2 text-xs text-muted-foreground">{item.content}</p>
              </div>
            ))}
            {!data?.announcements?.length ? <p className="text-xs text-muted-foreground">Niciun anunț nou.</p> : null}
          </div>
        </div>

        <div className="rounded-[1.35rem] border border-border/70 bg-white/90 p-4 shadow-[0_14px_40px_rgba(15,23,42,0.045)]">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground">Sesizari deschise</p>
            <Link href="/resident/issues" className="text-xs text-primary">Gestionare</Link>
          </div>
          <div className="mt-2 space-y-2">
            {(data?.myIssues || []).slice(0, 3).map((issue) => (
              <div key={issue.id} className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/60 px-3 py-2">
                <p className="text-xs text-muted-foreground">{issue.title}</p>
                <StatusBadge status={issue.status} />
              </div>
            ))}
            {!data?.myIssues?.length ? <p className="text-xs text-muted-foreground">Nu ai sesizari active.</p> : null}
          </div>
        </div>

      </div>
    </div>
  );
}
