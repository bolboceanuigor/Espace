'use client';

import ResidentLayout from '@/components/layout/ResidentLayout';
import { useAuth } from '@/context/AuthContext';

export default function ResidentRootLayout({ children }: { children: React.ReactNode }) {
  const { user, org } = useAuth();

  const userName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || 'Locatar'
    : 'Locatar';

  return (
    <ResidentLayout
      userName={userName}
      apartmentNumber="Ap. 24"
      organizationName={org?.name || 'A.P.C. Demo'}
      notificationsCount={2}
    >
      {children}
    </ResidentLayout>
  );
}
