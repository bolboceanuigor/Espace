 'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

type MarketingLayoutProps = {
  children: React.ReactNode;
};

export default function MarketingLayout({ children }: MarketingLayoutProps) {
  const t = useTranslations('marketing.nav');
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-sm font-semibold text-foreground">
            {t('brand')}
          </Link>
          <nav className="flex items-center gap-3 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground">
              Acasă
            </Link>
            <Link href="/features" className="hover:text-foreground">
              {t('features')}
            </Link>
            <Link href="/pricing" className="hover:text-foreground">
              {t('pricing')}
            </Link>
            <Link href="/contact" className="hover:text-foreground">
              {t('contact')}
            </Link>
            <Link href="/login" className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white">
              Intră în platformă
            </Link>
          </nav>
        </div>
      </header>
      <main>{children}</main>
      <footer className="border-t border-border/60">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-4 py-6 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
          <p>{t('footerText')}</p>
          <p>{t('footerSupport')}</p>
        </div>
      </footer>
    </div>
  );
}
