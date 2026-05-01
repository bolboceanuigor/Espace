'use client';

import Link from 'next/link';
import MobilePageHeader from '@/components/common/MobilePageHeader';
import EmptyState from '@/components/common/EmptyState';

export default function SuperadminSettingsPage() {
  return (
    <div className="space-y-4 pb-24 md:pb-4">
      <MobilePageHeader title="Settings" subtitle="Superadmin settings and administrative tools." />
      <EmptyState
        title="Setări superadmin"
        description="Folosește linkurile de mai jos pentru modulele de configurare existente."
      />
      <div className="flex flex-wrap gap-2">
        <Link href="/superadmin/help" className="rounded-md border border-border/70 px-3 py-2 text-sm hover:bg-muted/50">
          Help Articles
        </Link>
        <Link href="/superadmin/email-templates" className="rounded-md border border-border/70 px-3 py-2 text-sm hover:bg-muted/50">
          Email Templates
        </Link>
        <Link href="/superadmin/system/status" className="rounded-md border border-border/70 px-3 py-2 text-sm hover:bg-muted/50">
          System Status
        </Link>
      </div>
    </div>
  );
}
