'use client';

import { LogOut, Mail, Phone, ShieldCheck, UserRound } from 'lucide-react';
import { Button, Card, PageHeader } from '@/components/ui';
import { residentProfile } from '@/lib/resident-mvp-data';

export default function ResidentAccountPage() {
  return (
    <div className="space-y-5 pb-4">
      <PageHeader title="Cont" description="Datele tale principale în aplicația Espace." />
      <Card>
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-[1.35rem] bg-foreground text-xl font-semibold text-background">
            {residentProfile.name.slice(0, 1)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-foreground">{residentProfile.name}</p>
            <p className="truncate text-sm text-muted-foreground">{residentProfile.email}</p>
          </div>
        </div>
        <div className="mt-6 space-y-3 text-sm">
          <Info icon={<Phone className="h-4 w-4" />} label="Telefon" value={residentProfile.phone} />
          <Info icon={<Mail className="h-4 w-4" />} label="Email" value={residentProfile.email} />
          <Info icon={<UserRound className="h-4 w-4" />} label="Apartament" value={`${residentProfile.apartment}, ${residentProfile.staircase}`} />
          <Info icon={<ShieldCheck className="h-4 w-4" />} label="Rol" value={residentProfile.role} />
        </div>
        <Button type="button" variant="danger" className="mt-6 w-full">
          <LogOut className="h-4 w-4" />
          Deconectare
        </Button>
      </Card>
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
