'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Home } from 'lucide-react';

type MarketingLayoutProps = {
  children: React.ReactNode;
};

export default function MarketingLayout({ children }: MarketingLayoutProps) {
  const t = useTranslations('marketing.nav');
  return (
    <div className="min-h-screen bg-[#f7f5f0] text-foreground">
      <header className="sticky top-0 z-50 border-b border-gray-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-400 to-teal-600 shadow-lg shadow-teal-500/20">
              <Home className="h-5 w-5 text-white" />
            </span>
            <span className="text-lg font-semibold tracking-tight text-gray-900">
              {t('brand')}
            </span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm text-gray-600 md:flex">
            <Link href="/features" className="transition hover:text-gray-900">
              {t('features')}
            </Link>
            <Link href="/pricing" className="transition hover:text-gray-900">
              {t('pricing')}
            </Link>
            <Link href="/contact" className="transition hover:text-gray-900">
              {t('contact')}
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden rounded-lg px-4 py-2.5 text-sm font-medium text-gray-600 transition hover:text-gray-900 sm:block"
            >
              Autentificare
            </Link>
            <Link
              href="/demo-request"
              className="rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-gray-800"
            >
              {t('requestDemo')}
            </Link>
          </div>
        </div>
      </header>
      <main>{children}</main>
      <footer className="border-t border-gray-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-teal-400 to-teal-600">
              <Home className="h-4 w-4 text-white" />
            </span>
            <span className="text-sm font-semibold text-gray-900">Espace</span>
          </div>
          <nav className="flex flex-wrap items-center gap-6 text-sm text-gray-500">
            <Link href="/features" className="transition hover:text-gray-900">{t('features')}</Link>
            <Link href="/pricing" className="transition hover:text-gray-900">{t('pricing')}</Link>
            <Link href="/contact" className="transition hover:text-gray-900">{t('contact')}</Link>
          </nav>
          <p className="text-sm text-gray-400">{t('footerText')}</p>
        </div>
      </footer>
    </div>
  );
}
