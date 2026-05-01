'use client';

import Link from 'next/link';
import MobilePageHeader from '@/components/common/MobilePageHeader';
import EmptyState from '@/components/common/EmptyState';

export default function AdminTeamRoutePage() {
  return (
    <div className="space-y-4 pb-24 md:pb-4">
      <MobilePageHeader title="Team" subtitle="Team management module entry point." />
      <EmptyState
        title="Team module moved"
        description="Acest modul este disponibil în ruta principală de echipă."
        actionLabel="Deschide Team"
        onAction={() => {
          window.location.href = '/team';
        }}
      />
      <p className="text-xs text-muted-foreground">
        Dacă butonul nu funcționează, accesează direct: <Link href="/team" className="text-primary hover:underline">/team</Link>
      </p>
    </div>
  );
}
