import AppShell from '@/components/layout/AppShell';

type LocalizedAppLayoutProps = {
  children: React.ReactNode;
};

export default function LocalizedAppLayout({ children }: LocalizedAppLayoutProps) {
  return <AppShell>{children}</AppShell>;
}
