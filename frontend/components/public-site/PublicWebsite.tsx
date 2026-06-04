'use client';

import Link from 'next/link';
import type { FormEvent } from 'react';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  ArrowRight,
  Banknote,
  Bell,
  Building2,
  CreditCard,
  Database,
  FileText,
  Gauge,
  Import,
  LineChart,
  Lock,
  Menu,
  MessageCircle,
  Phone,
  ReceiptText,
  ShieldCheck,
  Smartphone,
  Users,
  X,
} from 'lucide-react';
import { accessRequestsApi } from '@/lib/api';

type PageKind = 'home' | 'platform' | 'admins' | 'residents' | 'features' | 'pricing' | 'contact' | 'access' | 'security' | 'help';

function useLocale() {
  const params = useParams<{ locale?: string }>();
  return typeof params?.locale === 'string' ? params.locale : 'ro';
}

function localized(locale: string, href: string) {
  if (href.startsWith('http')) return href;
  return `/${locale}${href === '/' ? '' : href}`;
}

export function PublicNavbar() {
  const locale = useLocale();
  const t = useTranslations('publicSite.nav');
  const [open, setOpen] = useState(false);
  const links = [
    [t('platform'), '/platforma'],
    [t('features'), '/functionalitati'],
    [t('admins'), '/pentru-administratori'],
    [t('residents'), '/pentru-locatari'],
    [t('contact'), '/contact'],
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-[#F7F8F6]/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link href={localized(locale, '/')} className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#0F172A] text-sm font-semibold text-white shadow-sm">E</span>
          <span className="text-lg font-semibold tracking-tight text-slate-950">{t('brand')}</span>
        </Link>
        <nav className="hidden items-center gap-7 md:flex">
          {links.map(([label, href]) => (
            <Link key={href} href={localized(locale, href)} className="text-sm font-medium text-slate-600 hover:text-slate-950">
              {label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-3 md:flex">
          <Link href={localized(locale, '/login')} prefetch={false} className="rounded-full px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white hover:text-slate-950">{t('login')}</Link>
          <Link href={localized(locale, '/cere-acces')} className="rounded-full bg-[#145C55] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#104A45]">{t('requestAccess')}</Link>
        </div>
        <button onClick={() => setOpen((value) => !value)} className="md:hidden" aria-label={t('menuAriaLabel')}>
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>
      {open ? (
        <div className="border-t border-slate-200 bg-[#F7F8F6] px-4 py-4 md:hidden">
          <div className="grid gap-2">
            {links.map(([label, href]) => <Link key={href} href={localized(locale, href)} className="rounded-2xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-white">{label}</Link>)}
            <Link href={localized(locale, '/login')} prefetch={false} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800">{t('login')}</Link>
            <Link href={localized(locale, '/cere-acces')} className="rounded-2xl bg-[#145C55] px-3 py-2 text-sm font-semibold text-white">{t('requestAccess')}</Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}

export function PublicFooter() {
  const locale = useLocale();
  const t = useTranslations('publicSite.footer');
  const links = [
    [t('login'), '/login'],
    [t('requestAccess'), '/cere-acces'],
    [t('contact'), '/contact'],
  ] as const;
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
        <div className="max-w-md">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-2xl bg-[#0F172A] text-sm font-semibold text-white">E</span>
            <span className="font-semibold text-slate-950">{t('brand')}</span>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-500">{t('text')}</p>
        </div>
        <nav className="flex flex-wrap gap-3">
          {links.map(([label, href]) => (
            <Link key={href} href={localized(locale, href)} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:border-[#145C55]/30 hover:text-[#145C55]">
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}

export function CookieBanner() {
  const locale = useLocale();
  const t = useTranslations('publicSite.cookie');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('espace_cookie_ack') !== 'true') {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;
  return (
    <div className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-3xl rounded-lg border border-slate-200 bg-white p-4 shadow-xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-6 text-slate-600">
          {t('text')}
        </p>
        <div className="flex gap-2">
          <Link href={localized(locale, '/cookies')} className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
            {t('details')}
          </Link>
          <button
            onClick={() => {
              localStorage.setItem('espace_cookie_ack', 'true');
              setVisible(false);
            }}
            className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white"
          >
            {t('accept')}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProductMockup() {
  const t = useTranslations('publicSite.productMockup');
  const modules = t.raw('modules') as Array<{ title: string; text: string }>;
  const sidebar = t.raw('sidebar') as string[];
  const flowSteps = t.raw('flowSteps') as string[];
  return (
    <div className="relative rounded-[28px] border border-slate-200 bg-white p-3 shadow-[0_28px_80px_-48px_rgba(15,23,42,0.45)]">
      <div className="grid overflow-hidden rounded-[22px] border border-slate-200 bg-[#F7F8F6] md:grid-cols-[170px_1fr]">
        <aside className="hidden bg-[#0F172A] p-4 text-white md:block">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-2xl bg-white text-xs font-semibold text-[#145C55]">ES</span>
            <span className="text-sm font-semibold">{t('brand')}</span>
          </div>
          <div className="mt-8 space-y-2 text-xs text-white/60">
            {sidebar.map((item, index) => (
              <div key={item} className={`rounded-2xl px-3 py-2 ${index === 1 ? 'bg-white/10 text-white' : ''}`}>{item}</div>
            ))}
          </div>
        </aside>
        <div className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#145C55]">{t('eyebrow')}</p>
              <h3 className="mt-1 text-lg font-semibold tracking-tight text-slate-950">{t('title')}</h3>
            </div>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">{t('preview')}</span>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {modules.map((item) => (
              <div key={item.title} className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-950">{item.title}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">{item.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-950">{t('flowTitle')}</p>
            <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-4">
              {flowSteps.map((item) => (
                <span key={item} className="rounded-full bg-[#E7F3EF] px-3 py-2 text-center font-semibold text-[#145C55]">{item}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ eyebrow, title, text }: { eyebrow?: string; title: string; text?: string }) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      {eyebrow ? <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">{eyebrow}</p> : null}
      <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">{title}</h2>
      {text ? <p className="mt-4 text-base leading-7 text-slate-600">{text}</p> : null}
    </div>
  );
}

function FeatureCard({ icon: Icon, title, text, badge }: { icon: any; title: string; text: string; badge?: string }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700"><Icon className="h-5 w-5" /></span>
        {badge ? <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">{badge}</span> : null}
      </div>
      <h3 className="mt-4 font-semibold text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
    </article>
  );
}

function CTASection() {
  const locale = useLocale();
  const t = useTranslations('publicSite.cta');
  return (
    <section className="bg-[#0F172A] py-20 text-white">
      <div className="mx-auto max-w-4xl px-4 text-center">
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">{t('title')}</h2>
        <p className="mx-auto mt-4 max-w-2xl text-slate-300">{t('text')}</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href={localized(locale, '/cere-acces')} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#145C55] px-5 font-semibold text-white hover:bg-[#176B60]">
            {t('requestAccess')} <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href={localized(locale, '/login')} prefetch={false} className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/15 bg-white px-5 font-semibold text-slate-950 hover:bg-white/90">
            {t('login')}
          </Link>
        </div>
      </div>
    </section>
  );
}

export function AccessRequestForm({ source = 'ACCESS_REQUEST', compact = false }: { source?: 'ACCESS_REQUEST' | 'CONTACT_PAGE' | 'PUBLIC_WEBSITE'; compact?: boolean }) {
  const t = useTranslations('publicSite.accessForm');
  const [form, setForm] = useState({
    contactName: '',
    phone: '',
    email: '',
    city: '',
    type: 'APC',
    associationName: '',
    apcCode: '',
    address: '',
    apartmentsCount: '',
    contactRole: '',
    message: '',
    consent: false,
    website: '',
  });
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (!form.contactName.trim() || !form.phone.trim() || !form.city.trim()) {
        setError(t('validation'));
        return;
      }
      await accessRequestsApi.createAccessRequest({
        ...form,
        contactName: form.contactName.trim(),
        phone: form.phone.trim(),
        city: form.city.trim(),
        type: form.type as any,
        apartmentsCount: form.apartmentsCount ? Number(form.apartmentsCount) : undefined,
        email: form.email || undefined,
        associationName: form.associationName || undefined,
        apcCode: form.apcCode || undefined,
        address: form.address || undefined,
        contactRole: form.contactRole || undefined,
        message: form.message || undefined,
        source,
      });
      setDone(true);
    } catch (err: any) {
      setError(err?.message || t('submitError'));
    } finally {
      setSaving(false);
    }
  };
  if (done) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5">
        <h3 className="font-semibold text-emerald-950">{t('successTitle')}</h3>
        <p className="mt-2 text-sm text-emerald-800">{t('successBody')}</p>
      </div>
    );
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <input className="hidden" tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => setForm((p) => ({ ...p, website: e.target.value }))} />
      <div className={`grid gap-3 ${compact ? 'md:grid-cols-2' : 'md:grid-cols-2'}`}>
        <input required placeholder={t('contactName')} value={form.contactName} onChange={(e) => setForm((p) => ({ ...p, contactName: e.target.value }))} className="h-11 rounded-2xl border border-slate-200 px-3 text-sm outline-none focus:border-[#145C55]/40 focus:ring-2 focus:ring-[#145C55]/15" />
        <input required placeholder={t('phone')} value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} className="h-11 rounded-2xl border border-slate-200 px-3 text-sm outline-none focus:border-[#145C55]/40 focus:ring-2 focus:ring-[#145C55]/15" />
        <input type="email" placeholder={t('emailOptional')} value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} className="h-11 rounded-2xl border border-slate-200 px-3 text-sm outline-none focus:border-[#145C55]/40 focus:ring-2 focus:ring-[#145C55]/15" />
        <input required placeholder={t('city')} value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} className="h-11 rounded-2xl border border-slate-200 px-3 text-sm outline-none focus:border-[#145C55]/40 focus:ring-2 focus:ring-[#145C55]/15" />
        <select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))} className="h-11 rounded-2xl border border-slate-200 px-3 text-sm outline-none focus:border-[#145C55]/40 focus:ring-2 focus:ring-[#145C55]/15">
          <option value="APC">{t('typeOptions.APC')}</option>
          <option value="ADMINISTRATOR">{t('typeOptions.ADMINISTRATOR')}</option>
          <option value="PROPERTY_MANAGER">{t('typeOptions.PROPERTY_MANAGER')}</option>
          <option value="OTHER">{t('typeOptions.OTHER')}</option>
        </select>
        <input placeholder={t('associationNameOptional')} value={form.associationName} onChange={(e) => setForm((p) => ({ ...p, associationName: e.target.value }))} className="h-11 rounded-2xl border border-slate-200 px-3 text-sm outline-none focus:border-[#145C55]/40 focus:ring-2 focus:ring-[#145C55]/15" />
        <input placeholder={t('apcCodeOptional')} value={form.apcCode} onChange={(e) => setForm((p) => ({ ...p, apcCode: e.target.value }))} className="h-11 rounded-2xl border border-slate-200 px-3 text-sm outline-none focus:border-[#145C55]/40 focus:ring-2 focus:ring-[#145C55]/15" />
        <input placeholder={t('addressOptional')} value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} className="h-11 rounded-2xl border border-slate-200 px-3 text-sm outline-none focus:border-[#145C55]/40 focus:ring-2 focus:ring-[#145C55]/15" />
        <input type="number" min={1} placeholder={t('apartmentsCount')} value={form.apartmentsCount} onChange={(e) => setForm((p) => ({ ...p, apartmentsCount: e.target.value }))} className="h-11 rounded-2xl border border-slate-200 px-3 text-sm outline-none focus:border-[#145C55]/40 focus:ring-2 focus:ring-[#145C55]/15" />
        <input placeholder={t('contactRoleOptional')} value={form.contactRole} onChange={(e) => setForm((p) => ({ ...p, contactRole: e.target.value }))} className="h-11 rounded-2xl border border-slate-200 px-3 text-sm outline-none focus:border-[#145C55]/40 focus:ring-2 focus:ring-[#145C55]/15" />
      </div>
      <textarea placeholder={t('messageOptional')} value={form.message} onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))} className="min-h-[120px] w-full rounded-2xl border border-slate-200 p-3 text-sm outline-none focus:border-[#145C55]/40 focus:ring-2 focus:ring-[#145C55]/15" />
      <label className="flex items-start gap-2 text-sm text-slate-600">
        <input required type="checkbox" checked={form.consent} onChange={(e) => setForm((p) => ({ ...p, consent: e.target.checked }))} className="mt-1" />
        {t('consent')}
      </label>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button disabled={saving} className="inline-flex h-11 items-center justify-center rounded-full bg-[#145C55] px-5 text-sm font-semibold text-white hover:bg-[#104A45] disabled:opacity-60">
        {saving ? t('sending') : t('submit')}
      </button>
    </form>
  );
}

function HomePageContent() {
  const locale = useLocale();
  const t = useTranslations('publicSite.home');
  const moduleCards = t.raw('moduleCards') as Array<{ title: string; text: string }>;
  const roles = t.raw('roles') as Array<{ title: string; text: string }>;
  const moldovaItems = t.raw('moldovaItems') as string[];
  const moduleIcons = [Users, ReceiptText, Gauge, MessageCircle, Bell, ShieldCheck] as const;
  const roleIcons = [ShieldCheck, Building2, Smartphone] as const;
  return (
    <>
      <section className="relative overflow-hidden bg-[#F7F8F6] py-16 md:py-24">
        <div className="absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-[#E7F3EF] to-transparent" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[0.92fr_1.08fr] lg:px-8">
          <div className="max-w-2xl">
            <p className="inline-flex rounded-full border border-[#145C55]/15 bg-white px-3 py-1 text-sm font-semibold text-[#145C55] shadow-sm">
              {t('badge')}
            </p>
            <h1 className="mt-6 text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">
              {t('title')}
            </h1>
            <p className="mt-6 text-lg leading-8 text-slate-600">
              {t('text')}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href={localized(locale, '/cere-acces')} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#145C55] px-6 text-sm font-semibold text-white shadow-sm hover:bg-[#104A45]">
                {t('primaryCta')} <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href={localized(locale, '/login')} prefetch={false} className="inline-flex min-h-12 items-center justify-center rounded-full border border-slate-200 bg-white px-6 text-sm font-semibold text-slate-800 shadow-sm hover:border-[#145C55]/30 hover:text-[#145C55]">
                {t('secondaryCta')}
              </Link>
            </div>
            <p className="mt-5 text-sm leading-6 text-slate-500">
              {t('footnote')}
            </p>
          </div>
          <ProductMockup />
        </div>
      </section>

      <section className="bg-white py-20">
        <SectionHeader eyebrow={t('modulesEyebrow')} title={t('modulesTitle')} text={t('modulesText')} />
        <div className="mx-auto mt-10 grid max-w-7xl gap-4 px-4 sm:px-6 md:grid-cols-2 lg:grid-cols-3 lg:px-8">
          {moduleCards.map((item, index) => (
            <FeatureCard key={item.title} icon={moduleIcons[index] || ShieldCheck} title={item.title} text={item.text} />
          ))}
        </div>
      </section>

      <section className="bg-[#F7F8F6] py-20">
        <SectionHeader eyebrow={t('rolesEyebrow')} title={t('rolesTitle')} />
        <div className="mx-auto mt-10 grid max-w-6xl gap-4 px-4 sm:px-6 md:grid-cols-3 lg:px-8">
          {roles.map((item, index) => {
            const Icon = roleIcons[index] || ShieldCheck;
            return (
            <article key={item.title} className="rounded-[22px] border border-slate-200 bg-white p-6 shadow-card">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#E7F3EF] text-[#145C55]">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-5 text-lg font-semibold tracking-tight text-slate-950">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{item.text}</p>
            </article>
            );
          })}
        </div>
      </section>

      <section className="bg-white py-20">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[#145C55]">{t('moldovaEyebrow')}</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
              {t('moldovaTitle')}
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-600">
              {t('moldovaText')}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {moldovaItems.map((item) => (
              <div key={item} className="rounded-2xl border border-slate-200 bg-[#F7F8F6] p-5 text-sm font-semibold text-slate-800">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <CTASection />
    </>
  );
}

function FeatureGrid({ compact = false }: { compact?: boolean }) {
  const t = useTranslations('publicSite.featureGrid');
  const features = t.raw('items') as Array<{ title: string; text: string; badge?: string }>;
  const icons = [Building2, Users, ReceiptText, FileText, Banknote, CreditCard, Gauge, LineChart, Bell, MessageCircle, Import, Database, Lock, ShieldCheck, Smartphone, CreditCard, FileText, Bell] as const;
  return (
    <div className={`mx-auto grid max-w-7xl gap-4 px-4 sm:px-6 lg:px-8 ${compact ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-4'}`}>
      {features.map((item, index) => <FeatureCard key={item.title} icon={icons[index] || ShieldCheck} title={item.title} text={item.text} badge={item.badge ? t('badgePreparing') : undefined} />)}
    </div>
  );
}

function PricingPreview() {
  const locale = useLocale();
  const t = useTranslations('publicSite.pricing');
  const plans = t.raw('plans') as Array<{ name: string; text: string; features: string[] }>;
  return (
    <section className="bg-white py-20">
      <SectionHeader title={t('title')} text={t('text')} />
      <div className="mx-auto mt-10 grid max-w-6xl gap-4 px-4 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan) => <div key={plan.name} className="rounded-lg border border-slate-200 bg-white p-5"><h3 className="text-xl font-semibold text-slate-950">{plan.name}</h3><p className="mt-2 text-sm text-slate-500">{plan.text}</p><p className="mt-4 font-semibold text-slate-950">{t('customOffer')}</p><ul className="mt-4 space-y-2 text-sm text-slate-600">{plan.features.map((item) => <li key={item}>• {item}</li>)}</ul><Link href={localized(locale, '/cere-acces')} className="mt-5 inline-flex rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">{t('requestAccess')}</Link></div>)}
      </div>
    </section>
  );
}

function PlatformPage() {
  const t = useTranslations('publicSite.platform');
  const cards = t.raw('cards') as Array<{ title: string; text: string }>;
  const icons = [ShieldCheck, Building2, Smartphone] as const;
  return (
    <section className="bg-white py-20"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><SectionHeader title={t('title')} text={t('text')} /><div className="mt-10 grid gap-4 md:grid-cols-3">{cards.map((card, index) => <FeatureCard key={card.title} icon={icons[index] || ShieldCheck} title={card.title} text={card.text} />)}</div><div className="mt-12"><ProductMockup /></div></div></section>
  );
}

function AdminsPage() {
  const locale = useLocale();
  const t = useTranslations('publicSite.admins');
  return <section className="bg-white py-20"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><SectionHeader title={t('title')} text={t('text')} /><div className="mt-10"><FeatureGrid compact /></div><div className="mt-10 text-center"><Link href={localized(locale, '/cere-acces')} className="rounded-md bg-emerald-600 px-5 py-3 font-semibold text-white">{t('cta')}</Link></div></div></section>;
}

function ResidentsPage() {
  const t = useTranslations('publicSite.residents');
  const items = t.raw('items') as string[];
  return <section className="bg-white py-20"><div className="mx-auto max-w-5xl px-4"><SectionHeader title={t('title')} text={t('text')} /><div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{items.map((item) => <div key={item} className="rounded-lg border border-slate-200 bg-white p-5 font-semibold text-slate-800">{item}</div>)}</div><p className="mt-10 text-center text-slate-600">{t('footnote')}</p></div></section>;
}

function ContactPage({ access = false }: { access?: boolean }) {
  const locale = useLocale();
  const t = useTranslations('publicSite.contact');
  return (
    <section className="bg-[#F7F8F6] py-16">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[#145C55]">{t('eyebrow')}</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">{access ? t('accessTitle') : t('contactTitle')}</h1>
          <p className="mt-4 leading-7 text-slate-600">{access ? t('accessText') : t('contactText')}</p>
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-600 shadow-card"><Phone className="mb-3 h-5 w-5 text-[#145C55]" />{t('assistedImplementation')}</div>
          {!access ? (
            <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-card">
              {t('legalPrefix')} <Link href={localized(locale, '/legal')} className="font-semibold text-[#145C55]">{t('legalLink')}</Link>.
            </div>
          ) : null}
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-card"><AccessRequestForm source={access ? 'ACCESS_REQUEST' : 'CONTACT_PAGE'} /></div>
      </div>
    </section>
  );
}

function FeaturesPage() {
  const t = useTranslations('publicSite.features');
  return <section className="bg-white py-20"><SectionHeader title={t('title')} text={t('text')} /><div className="mt-10"><FeatureGrid /></div></section>;
}

function SecurityPage() {
  const t = useTranslations('publicSite.security');
  const cards = t.raw('cards') as Array<{ title: string; text: string }>;
  const icons = [Lock, ShieldCheck, Database] as const;
  return <section className="bg-white py-20"><div className="mx-auto max-w-6xl px-4"><SectionHeader title={t('title')} text={t('text')} /><div className="mt-10 grid gap-4 md:grid-cols-3">{cards.map((card, index) => <FeatureCard key={card.title} icon={icons[index] || ShieldCheck} title={card.title} text={card.text} />)}</div></div></section>;
}

function HelpLandingPage() {
  const locale = useLocale();
  const t = useTranslations('publicSite.help');
  return <section className="bg-white py-20"><div className="mx-auto max-w-4xl px-4 text-center"><h1 className="text-4xl font-semibold text-slate-950">{t('title')}</h1><p className="mt-4 text-slate-600">{t('text')}</p><Link href={localized(locale, '/help')} className="mt-8 inline-flex rounded-md bg-emerald-600 px-5 py-3 font-semibold text-white">{t('cta')}</Link></div></section>;
}

export function PublicWebsitePage({ page = 'home' }: { page?: PageKind }) {
  return (
    <div className="min-h-screen bg-[#F7F8F6] text-slate-950">
      <PublicNavbar />
      {page === 'home' ? <HomePageContent /> : null}
      {page === 'platform' ? <PlatformPage /> : null}
      {page === 'admins' ? <AdminsPage /> : null}
      {page === 'residents' ? <ResidentsPage /> : null}
      {page === 'features' ? <FeaturesPage /> : null}
      {page === 'pricing' ? <PricingPreview /> : null}
      {page === 'contact' ? <ContactPage /> : null}
      {page === 'access' ? <ContactPage access /> : null}
      {page === 'security' ? <SecurityPage /> : null}
      {page === 'help' ? <HelpLandingPage /> : null}
      {page !== 'home' && page !== 'access' && page !== 'contact' ? <CTASection /> : null}
      <PublicFooter />
      <CookieBanner />
    </div>
  );
}
