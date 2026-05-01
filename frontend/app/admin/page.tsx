'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Bell, CreditCard, Home, Megaphone, MessageCircle, PlusCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  adminStructureApi,
  communicationsApi,
  invoicesApi,
  paymentsApi,
  reportsApi,
  supportChatApi,
} from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { defaultLocale, isLocale } from '@/i18n';
import LoadingState from '@/components/common/LoadingState';

type DashboardData = {
  activeAnnouncements: number;
  overduePayments: number;
  unreadMessages: number;
  homesCount: number;
  latestAnnouncements: any[];
  recentPayments: any[];
  recentMessages: any[];
  source: 'api' | 'fallback';
};

const fallbackData: DashboardData = {
  activeAnnouncements: 0,
  overduePayments: 0,
  unreadMessages: 0,
  homesCount: 0,
  latestAnnouncements: [
    { id: 'fallback-announcement-1', title: 'Bun venit în Espace PMS', content: 'Anunțurile importante vor apărea aici.' },
  ],
  recentPayments: [
    { id: 'fallback-payment-1', amount: 0, status: 'În așteptare', apartment: { number: '-' } },
  ],
  recentMessages: [
    { id: 'fallback-message-1', title: 'Mesajele recente vor apărea aici', status: 'OPEN' },
  ],
  source: 'fallback',
};

function toArray(value: any): any[] {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.items)) return value.items;
  return [];
}

export default function AdminPage() {
  const { user } = useAuth();
  const params = useParams<{ locale?: string }>();
  const localeParam = typeof params?.locale === 'string' ? params.locale : defaultLocale;
  const locale = isLocale(localeParam) ? localeParam : defaultLocale;
  const [data, setData] = useState<DashboardData>(fallbackData);
  const [loading, setLoading] = useState(true);

  const href = {
    avizier: `/${locale}/avizier`,
    plati: `/${locale}/plati`,
    dashboard: `/${locale}/dashboard`,
    mesaje: `/${locale}/mesaje`,
    cont: `/${locale}/cont`,
    createAnnouncement: `/${locale}/admin/announcements`,
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const [announcementsRes, debtsRes, paymentsRes, supportRes, communityRes, apartmentsRes] = await Promise.all([
          communicationsApi.listAdminAnnouncements(),
          reportsApi.adminDebts(),
          paymentsApi.adminList({ limit: 5 }),
          supportChatApi.adminListConversations({}),
          supportChatApi.adminListCommunity(),
          adminStructureApi.listApartments({ limit: 1 }),
        ]);

        if (!active) return;
        const announcements = toArray(announcementsRes.data);
        const debts = toArray(debtsRes.data);
        const payments = toArray(paymentsRes.data);
        const supportConversations = toArray(supportRes.data);
        const communityConversations = toArray(communityRes.data);
        const apartmentsPayload = apartmentsRes.data || {};
        const homesCount = Number(apartmentsPayload.total ?? apartmentsPayload.count ?? toArray(apartmentsPayload).length ?? 0);

        setData({
          activeAnnouncements: announcements.length,
          overduePayments: debts.filter((row: any) => Number(row.currentDebt || row.totalDue || 0) > 0).length,
          unreadMessages:
            supportConversations.filter((item: any) => item.unreadCount > 0 || String(item.status || '').toUpperCase() !== 'CLOSED').length +
            communityConversations.length,
          homesCount,
          latestAnnouncements: announcements.slice(0, 3),
          recentPayments: payments.slice(0, 3),
          recentMessages: [...supportConversations, ...communityConversations].slice(0, 3),
          source: 'api',
        });
      } catch {
        if (active) setData(fallbackData);
      } finally {
        if (active) setLoading(false);
      }
    };

    load().catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  if (loading) return <LoadingState label="Se încarcă pagina Acasă..." />;

  const kpis = [
    { label: 'Anunțuri active', value: data.activeAnnouncements, icon: Megaphone, href: href.avizier },
    { label: 'Plăți restante', value: data.overduePayments, icon: CreditCard, href: href.plati },
    { label: 'Mesaje necitite', value: data.unreadMessages, icon: MessageCircle, href: href.mesaje },
    { label: 'Apartamente / locuințe', value: data.homesCount, icon: Home, href: href.cont },
  ];

  return (
    <div className="space-y-5 overflow-x-hidden pb-24 md:space-y-6 md:pb-4">
      <section className="overflow-hidden rounded-[1.75rem] border border-border/70 bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] md:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="inline-flex rounded-full border border-border/70 bg-muted/60 px-3 py-1 text-xs font-semibold text-muted-foreground">Acasă</p>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground md:text-4xl">
              {user?.firstName ? `Salut, ${user.firstName}` : 'Dashboard Espace PMS'}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
              Ai cele mai importante informații într-un singur loc: avizier, plăți, mesaje și locuințe.
            </p>
          </div>
          {data.source === 'fallback' ? (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
              Date demonstrative
            </span>
          ) : null}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.label} href={item.href} className="rounded-[1.35rem] border border-border/70 bg-white/90 p-4 shadow-[0_14px_40px_rgba(15,23,42,0.045)] transition hover:-translate-y-0.5 hover:border-foreground/15 hover:shadow-[0_20px_54px_rgba(15,23,42,0.08)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">{item.label}</p>
                  <p className="mt-2 text-3xl font-semibold text-foreground">{item.value}</p>
                </div>
                <span className="rounded-2xl bg-muted p-2 text-foreground">
                  <Icon className="h-5 w-5" />
                </span>
              </div>
            </Link>
          );
        })}
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-[1.35rem] border border-border/70 bg-white/90 p-4 shadow-[0_14px_40px_rgba(15,23,42,0.045)]">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Ultimele anunțuri</h3>
            <Link href={href.avizier} className="text-xs font-medium text-primary">Vezi toate</Link>
          </div>
          <div className="space-y-2">
            {data.latestAnnouncements.map((item) => (
              <Link key={item.id} href={href.avizier} className="block rounded-2xl border border-border/60 bg-background/60 p-3 hover:bg-muted/50">
                <p className="line-clamp-1 text-sm font-medium text-foreground">{item.title}</p>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.content || item.description || 'Fără descriere.'}</p>
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-[1.35rem] border border-border/70 bg-white/90 p-4 shadow-[0_14px_40px_rgba(15,23,42,0.045)]">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Plăți recente</h3>
            <Link href={href.plati} className="text-xs font-medium text-primary">Vezi plăți</Link>
          </div>
          <div className="space-y-2">
            {data.recentPayments.map((item) => (
              <Link key={item.id} href={href.plati} className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-background/60 p-3 hover:bg-muted/50">
                <div>
                  <p className="text-sm font-medium text-foreground">Apartament #{item.apartment?.number || '-'}</p>
                  <p className="text-xs text-muted-foreground">{item.status || 'Înregistrată'}</p>
                </div>
                <span className="text-sm font-semibold text-foreground">{Number(item.amount || 0).toFixed(2)} MDL</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-[1.35rem] border border-border/70 bg-white/90 p-4 shadow-[0_14px_40px_rgba(15,23,42,0.045)]">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Mesaje recente</h3>
            <Link href={href.mesaje} className="text-xs font-medium text-primary">Deschide</Link>
          </div>
          <div className="space-y-2">
            {data.recentMessages.map((item) => (
              <Link key={item.id} href={href.mesaje} className="block rounded-2xl border border-border/60 bg-background/60 p-3 hover:bg-muted/50">
                <p className="line-clamp-1 text-sm font-medium text-foreground">{item.title || item.subject || 'Conversație'}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.status || 'Activă'}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[1.35rem] border border-border/70 bg-white/90 p-4 shadow-[0_14px_40px_rgba(15,23,42,0.045)]">
        <h3 className="text-sm font-semibold text-foreground">Acțiuni rapide</h3>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Link href={href.createAnnouncement} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-foreground px-4 text-sm font-semibold text-background shadow-[0_14px_34px_rgba(15,23,42,0.16)]">
            <PlusCircle className="h-4 w-4" />
            Creează anunț
          </Link>
          <Link href={href.plati} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-border/70 bg-white px-4 text-sm font-semibold text-foreground hover:bg-muted/50">
            <CreditCard className="h-4 w-4" />
            Vezi plăți
          </Link>
          <Link href={href.mesaje} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-border/70 bg-white px-4 text-sm font-semibold text-foreground hover:bg-muted/50">
            <Bell className="h-4 w-4" />
            Deschide mesaje
          </Link>
        </div>
      </section>
    </div>
  );
}
