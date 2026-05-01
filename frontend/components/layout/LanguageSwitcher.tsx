'use client';

import { usePathname, useRouter } from 'next/navigation';
import { defaultLocale, isLocale, locales, type Locale } from '@/i18n';
import { useAuth } from '@/context/AuthContext';

const LABELS: Record<Locale, string> = {
  ro: 'RO',
  ru: 'RU',
  en: 'EN',
};

export default function LanguageSwitcher() {
  const pathname = usePathname();
  const router = useRouter();
  const { updatePreferences } = useAuth();

  const segments = pathname.split('/').filter(Boolean);
  const currentLocale = segments[0] && isLocale(segments[0]) ? segments[0] : defaultLocale;

  const handleLocaleChange = (nextLocale: Locale) => {
    const nextSegments = [...segments];
    if (nextSegments[0] && isLocale(nextSegments[0])) {
      nextSegments[0] = nextLocale;
    } else {
      nextSegments.unshift(nextLocale);
    }

    document.cookie = `locale=${nextLocale}; path=/; max-age=31536000; samesite=lax`;
    updatePreferences({ locale: nextLocale }).catch(() => undefined);
    router.push(`/${nextSegments.join('/')}`);
  };

  return (
    <div className="flex items-center justify-center">
      <select
        aria-label="Language"
        value={currentLocale}
        onChange={(event) => handleLocaleChange(event.target.value as Locale)}
        className="w-full rounded-xl border border-border/60 bg-background px-2 py-1.5 text-xs font-medium text-foreground transition duration-150 ease-out hover:bg-muted/60"
      >
        {locales.map((locale) => (
          <option key={locale} value={locale}>
            {LABELS[locale]}
          </option>
        ))}
      </select>
    </div>
  );
}
