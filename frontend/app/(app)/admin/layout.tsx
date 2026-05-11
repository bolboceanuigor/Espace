'use client';

import AdminLayout from '@/components/layout/AdminLayout';
import { useAuth } from '@/context/AuthContext';

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  const { user, org, logout } = useAuth();

  const userInitials = user
    ? `${(user.firstName || '')[0] || ''}${(user.lastName || '')[0] || ''}`.toUpperCase() || 'AD'
    : 'AD';

  return (
    <AdminLayout
      organizationName={org?.name || 'A.P.C. Demo'}
      organizationCode={org?.code || 'A0123-0940'}
      organizationStatus={org?.status || 'ACTIVE'}
      userInitials={userInitials}
      userEmail={user?.email || 'admin@espace.md'}
      notificationsCount={0}
      onLogout={logout}
    >
      {children}
    </AdminLayout>
  );
}
