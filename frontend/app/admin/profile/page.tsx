'use client';

import { useAuth } from '@/context/AuthContext';
import MobilePageHeader from '@/components/common/MobilePageHeader';
import PushOptInCard from '@/components/notifications/PushOptInCard';

export default function AdminProfilePage() {
  const { user, logout } = useAuth();

  return (
    <div className="space-y-4">
      <MobilePageHeader title="Profil admin" subtitle="Detalii cont si optiuni rapide." />

      <div className="rounded-2xl border border-border/70 bg-card p-4">
        <p className="text-sm text-muted-foreground">Nume</p>
        <p className="text-base font-medium text-foreground">{`${user?.firstName || ''} ${user?.lastName || ''}`.trim() || '-'}</p>
        <p className="mt-3 text-sm text-muted-foreground">Email</p>
        <p className="text-base text-foreground">{user?.email || '-'}</p>
      </div>

      <PushOptInCard />

      <button
        onClick={() => logout()}
        className="min-h-11 w-full rounded-xl border border-border/70 bg-card px-4 py-3 text-left text-sm text-foreground"
      >
        Logout
      </button>
    </div>
  );
}
