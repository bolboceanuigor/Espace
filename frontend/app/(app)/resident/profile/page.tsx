'use client';

import Link from 'next/link';
import { Bell, Building2, LogOut, Mail, Phone, UserRound } from 'lucide-react';
import { Button, Card, PageHeader } from '@/components/ui';
import { residentProfile } from '@/lib/resident-mvp-data';

export default function ResidentProfilePage() {
  return (
    <div className="space-y-5 pb-4">
      <PageHeader title="Profil" description="Profilul locatarului și setări rapide." />
      <Card>
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-[1.35rem] bg-foreground text-xl font-semibold text-background">
            {residentProfile.name.slice(0, 1)}
          </div>
          <div>
            <p className="text-lg font-semibold text-foreground">{residentProfile.name}</p>
            <p className="text-sm text-muted-foreground">{residentProfile.role}</p>
          </div>
        </div>
        <div className="mt-6 grid gap-3">
          <Info icon={<Phone className="h-4 w-4" />} label="Telefon" value={residentProfile.phone} />
          <Info icon={<Mail className="h-4 w-4" />} label="Email" value={residentProfile.email} />
          <Info icon={<Building2 className="h-4 w-4" />} label="Apartament" value={`${residentProfile.apartment}, ${residentProfile.staircase}`} />
          <Info icon={<UserRound className="h-4 w-4" />} label="Asociație" value={residentProfile.building} />
        </div>
      </Card>
      <div className="grid gap-3">
        <Link href="/resident/notifications" className="inline-flex min-h-12 items-center gap-3 rounded-2xl border border-border/70 bg-white px-4 text-sm font-semibold text-foreground">
          <Bell className="h-4 w-4" />
          Notificări
        </Link>
        <Button type="button" variant="danger" className="w-full">
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
