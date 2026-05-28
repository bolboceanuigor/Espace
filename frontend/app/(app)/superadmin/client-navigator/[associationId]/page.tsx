import { ClientNavigatorPage } from '@/components/superadmin-search/SuperadminCommandPalette';

export default function Page({ params }: { params: { associationId: string } }) {
  return <ClientNavigatorPage associationId={params.associationId} />;
}
