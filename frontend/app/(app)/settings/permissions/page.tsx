'use client';

import { PageHeader } from '@/components/ui';

export default function PermissionsPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Permissions"
        description="Simple access matrix for your organization."
      />
      <div className="rounded-3xl border border-border/60 bg-card/90 p-5 shadow-[0_18px_48px_-30px_rgba(109,40,217,0.35)]">
        <div className="space-y-2">
          <div className="rounded-2xl border border-border/60 p-3">
            <p className="text-sm font-medium text-foreground">ADMIN</p>
            <p className="text-sm text-muted-foreground">Full access to organization data and team management.</p>
          </div>
          <div className="rounded-2xl border border-border/60 p-3">
            <p className="text-sm font-medium text-foreground">MANAGER</p>
            <p className="text-sm text-muted-foreground">Access limited to assigned properties and related reservations.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
