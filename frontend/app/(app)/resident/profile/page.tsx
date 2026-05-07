'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Bell, Building2, LogOut, Mail, Phone, UserRound } from 'lucide-react';
import { Button, Card, PageHeader } from '@/components/ui';
import { residentDemoApi } from '@/lib/api';
import { normalizeResidentContext, residentProfile } from '@/lib/resident-mvp-data';
import { demoLogout } from '@/lib/demo-auth';
import { defaultLocale, isLocale } from '@/i18n';
import { useLocalizedPath } from '@/lib/use-localized-path';

export default function ResidentProfilePage() {
  const params = useParams<{ locale?: string }>();
  const localeParam = typeof params?.locale === 'string' ? params.locale : defaultLocale;
  const locale = isLocale(localeParam) ? localeParam : defaultLocale;
  const localizedPath = useLocalizedPath();
  const [profile, setProfile] = useState<ReturnType<typeof normalizeResidentContext> | null>(null);

  useEffect(() => {
    let active = true;
    residentDemoApi
      .context()
      .then((res) => {
        if (active) setProfile(normalizeResidentContext(res.data));
      })
      .catch(() => {
        if (active) {
          setProfile({
            ...residentProfile,
            hasApartment: true,
            emptyStateMessage: '',
          } as ReturnType<typeof normalizeResidentContext>);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-5 pb-4">
      <PageHeader title="Profil" description="Profilul locatarului și setări rapide." />
      {!profile ? <Card className="p-5 text-sm font-medium text-muted-foreground">Se încarcă profilul...</Card> : null}
      {profile ? (
      <Card>
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-[1.35rem] bg-foreground text-xl font-semibold text-background">
            {profile.name.slice(0, 1)}
          </div>
          <div>
            <p className="text-lg font-semibold text-foreground">{profile.name}</p>
            <p className="text-sm text-muted-foreground">{profile.role}</p>
          </div>
        </div>
        <div className="mt-6 grid gap-3">
          <Info icon={<Phone className="h-4 w-4" />} label="Telefon" value={profile.phone} />
          <Info icon={<Mail className="h-4 w-4" />} label="Email" value={profile.email} />
          <Info icon={<Building2 className="h-4 w-4" />} label="Apartament" value={[profile.apartment, profile.staircase].filter(Boolean).join(', ')} />
          <Info icon={<UserRound className="h-4 w-4" />} label="Asociație" value={profile.building} />
        </div>
      </Card>
      ) : null}
      <div className="grid gap-3">
        <Link href={localizedPath('/resident/notifications')} className="inline-flex min-h-12 items-center gap-3 rounded-2xl border border-border/70 bg-white px-4 text-sm font-semibold text-foreground">
          <Bell className="h-4 w-4" />
          Notificări
        </Link>
        <Button type="button" variant="danger" className="w-full" onClick={() => demoLogout(locale)}>
          <LogOut className="h-4 w-4" />
          Deconectare
        </Button>
      </div>
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
