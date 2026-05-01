'use client';

import Link from 'next/link';
import MobilePageHeader from '@/components/common/MobilePageHeader';
import EmptyState from '@/components/common/EmptyState';

export default function ResidentSettingsPage() {
  return (
    <div className="space-y-4 pb-24 md:pb-4">
      <MobilePageHeader title="Settings" subtitle="Resident account settings and preferences." />
      <EmptyState
        title="Alege ce dorești să configurezi"
        description="Setările de notificări sunt disponibile acum."
        actionLabel="Notificări"
        onAction={() => {
          window.location.href = '/resident/settings/notifications';
        }}
      />
      <Link href="/resident/profile" className="text-sm text-primary hover:underline">
        Go to profile
      </Link>
    </div>
  );
}
