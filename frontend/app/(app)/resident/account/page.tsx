'use client';

import { useEffect, useState } from 'react';
import { LogOut, Mail, Phone, ShieldCheck, UserRound } from 'lucide-react';
import { useParams } from 'next/navigation';
import { Button, Card, PageHeader } from '@/components/ui';
import { residentDemoApi } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import { normalizeResidentContext, residentProfile } from '@/lib/resident-mvp-data';
import { demoLogout } from '@/lib/demo-auth';
import { defaultLocale, isLocale } from '@/i18n';

export default function ResidentAccountPage() {
  const params = useParams<{ locale?: string }>();
  const localeParam = typeof params?.locale === 'string' ? params.locale : defaultLocale;
  const locale = isLocale(localeParam) ? localeParam : defaultLocale;
  const [profile, setProfile] = useState<ReturnType<typeof normalizeResidentContext> | null>(null);
  const [source, setSource] = useState<'loading' | 'api' | 'fallback'>('loading');

  useEffect(() => {
    const storedUser = getStoredUser();
    if (storedUser) {
      setProfile({
        ...residentProfile,
        name: `${storedUser.firstName || ''} ${storedUser.lastName || ''}`.trim() || residentProfile.name,
        email: storedUser.email || residentProfile.email,
        phone: storedUser.phone || residentProfile.phone,
        hasApartment: false,
        emptyStateMessage: 'Se verifică apartamentul conectat contului tău.',
      } as ReturnType<typeof normalizeResidentContext>);
    }

    let active = true;
    residentDemoApi
      .context()
      .then((res) => {
        if (!active) return;
        setProfile(normalizeResidentContext(res.data));
        setSource('api');
      })
      .catch(() => {
        if (!active) return;
        setSource('fallback');
        setProfile({
          ...residentProfile,
          hasApartment: true,
          emptyStateMessage: '',
        } as ReturnType<typeof normalizeResidentContext>);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        title="Cont"
        description="Datele tale principale în aplicația Espace."
        rightSlot={
          <span className="rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs font-semibold text-muted-foreground">
            {source === 'loading' ? 'Se încarcă...' : source === 'api' ? 'Date reale' : 'Date temporare — API indisponibil'}
          </span>
        }
      />
      {!profile ? <Card className="p-5 text-sm font-medium text-muted-foreground">Se încarcă profilul...</Card> : null}
      {profile ? (
      <Card>
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-[1.35rem] bg-foreground text-xl font-semibold text-background">
            {profile.name.slice(0, 1)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-foreground">{profile.name}</p>
            <p className="truncate text-sm text-muted-foreground">{profile.email}</p>
          </div>
        </div>
        <div className="mt-6 space-y-3 text-sm">
          <Info icon={<Phone className="h-4 w-4" />} label="Telefon" value={profile.phone} />
          <Info icon={<Mail className="h-4 w-4" />} label="Email" value={profile.email} />
          <Info icon={<UserRound className="h-4 w-4" />} label="Apartament" value={`${profile.apartment}, ${profile.staircase}`} />
          <Info icon={<ShieldCheck className="h-4 w-4" />} label="Rol" value={profile.role} />
        </div>
        <Button type="button" variant="danger" className="mt-6 w-full" onClick={() => demoLogout(locale)}>
          <LogOut className="h-4 w-4" />
          Deconectare
        </Button>
      </Card>
      ) : null}
    </div>
  );
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border/70 bg-muted/25 p-3">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}
