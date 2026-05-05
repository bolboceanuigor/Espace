'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';

type MarketingLayoutProps = {
  children: React.ReactNode;
};

export default function MarketingLayout({ children }: MarketingLayoutProps) {
  const t = useTranslations('marketing.nav');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4">
          {/* Logo */}
          <Link href="/" className="text-xl font-semibold tracking-tight text-foreground">
            Espace
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden items-center gap-8 md:flex">
            <Link 
              href="/features" 
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {t('features')}
            </Link>
            <Link 
              href="/pricing" 
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {t('pricing')}
            </Link>
            <Link 
              href="/contact" 
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {t('contact')}
            </Link>
          </nav>

          {/* Desktop CTA */}
          <div className="hidden items-center gap-3 md:flex">
            <Link 
              href="/demo" 
              className="rounded-full border border-border px-5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              {t('tryDemo')}
            </Link>
            <Link 
              href="/demo-request" 
              className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              {t('requestDemo')}
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            type="button"
            className="md:hidden rounded-lg p-2 text-foreground hover:bg-muted"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="border-t border-border/40 bg-background px-4 py-4 md:hidden">
            <nav className="flex flex-col gap-4">
              <Link 
                href="/features" 
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => setMobileMenuOpen(false)}
              >
                {t('features')}
              </Link>
              <Link 
                href="/pricing" 
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => setMobileMenuOpen(false)}
              >
                {t('pricing')}
              </Link>
              <Link 
                href="/contact" 
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => setMobileMenuOpen(false)}
              >
                {t('contact')}
              </Link>
              <div className="mt-2 flex flex-col gap-3 border-t border-border/40 pt-4">
                <Link 
                  href="/demo" 
                  className="rounded-full border border-border px-5 py-2.5 text-center text-sm font-medium text-foreground"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {t('tryDemo')}
                </Link>
                <Link 
                  href="/demo-request" 
                  className="rounded-full bg-primary px-5 py-2.5 text-center text-sm font-medium text-white"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {t('requestDemo')}
                </Link>
              </div>
            </nav>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main>{children}</main>

      {/* Footer */}
      <footer className="border-t border-border/40 bg-card/50">
        <div className="mx-auto w-full max-w-6xl px-4 py-12">
          <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
            {/* Brand */}
            <div className="max-w-xs">
              <Link href="/" className="text-xl font-semibold tracking-tight text-foreground">
                Espace
              </Link>
              <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
                Platformă completă pentru administrarea asociațiilor de proprietari.
              </p>
            </div>

            {/* Links */}
            <div className="flex flex-wrap gap-12">
              <div>
                <h4 className="text-sm font-semibold text-foreground">Produs</h4>
                <nav className="mt-4 flex flex-col gap-3">
                  <Link href="/features" className="text-sm text-muted-foreground hover:text-foreground">
                    Funcționalități
                  </Link>
                  <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground">
                    Prețuri
                  </Link>
                  <Link href="/demo" className="text-sm text-muted-foreground hover:text-foreground">
                    Demo
                  </Link>
                </nav>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground">Companie</h4>
                <nav className="mt-4 flex flex-col gap-3">
                  <Link href="/contact" className="text-sm text-muted-foreground hover:text-foreground">
                    Contact
                  </Link>
                  <Link href="/demo-request" className="text-sm text-muted-foreground hover:text-foreground">
                    Solicită demo
                  </Link>
                </nav>
              </div>
            </div>
          </div>

          {/* Bottom */}
          <div className="mt-12 flex flex-col gap-4 border-t border-border/40 pt-8 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-muted-foreground">
              {t('footerText')}
            </p>
            <p className="text-sm text-muted-foreground">
              {t('footerSupport')}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
