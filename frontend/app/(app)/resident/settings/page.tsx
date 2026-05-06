'use client';

import Link from 'next/link';
import MobilePageHeader from '@/components/common/MobilePageHeader';
import EmptyState from '@/components/common/EmptyState';
import { useLocalizedPath } from '@/lib/use-localized-path';

export default function ResidentSettingsPage() {
  const localizedPath = useLocalizedPath();

  return (
    <div className="space-y-4 pb-24 md:pb-4">
      <MobilePageHeader title="Setări" subtitle="Preferințele contului de locatar." />
      <EmptyState
        title="Alege ce dorești să configurezi"
        description="Setările de notificări sunt disponibile acum."
        actionLabel="Notificări"
        onAction={() => {
          window.location.href = localizedPath('/resident/settings/notifications');
        }}
      />
      <Link href={localizedPath('/resident/profile')} className="text-sm text-primary hover:underline">
        Mergi la profil
      </Link>
    </div>
  );
}
