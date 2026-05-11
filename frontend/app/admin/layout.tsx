import AdminAppShell from '@/components/layout/AdminAppShell';

export default function AdminSegmentLayout({ children }: { children: React.ReactNode }) {
  return <AdminAppShell>{children}</AdminAppShell>;
}
