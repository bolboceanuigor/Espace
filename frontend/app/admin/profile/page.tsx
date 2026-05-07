'use client';

import { LogOut, Mail, ShieldCheck, UserRound } from 'lucide-react';
import { Button, Card, PageHeader } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';

export default function AdminProfilePage() {
  const { user, org, logout } = useAuth();
  const displayName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.email || 'Administrator';
  const initial = displayName.slice(0, 1).toUpperCase();

  return (
    <div className="space-y-5 pb-4">
      <PageHeader title="Profil administrator" description="Profilul administratorului pentru asociația curentă." />
      <Card>
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-[1.35rem] bg-foreground text-xl font-semibold text-background">{initial}</div>
          <div>
            <p className="text-lg font-semibold text-foreground">{displayName}</p>
            <p className="text-sm text-muted-foreground">{user?.email || 'Email indisponibil'}</p>
          </div>
        </div>
        <div className="mt-6 space-y-3 text-sm">
          <Info icon={<Mail className="h-4 w-4" />} label="Email" value={user?.email || 'Email indisponibil'} />
          <Info icon={<ShieldCheck className="h-4 w-4" />} label="Rol" value="Administrator" />
          <Info icon={<UserRound className="h-4 w-4" />} label="A.P.C." value={org?.name || 'Asociația curentă'} />
        </div>
        <Button type="button" variant="danger" className="mt-6 w-full" onClick={() => logout()}>
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
