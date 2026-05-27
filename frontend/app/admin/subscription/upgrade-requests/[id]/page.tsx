import { AdminUpgradeRequestDetailPage } from '@/components/subscription/AdminUpgradeRequestPages';

export default function AdminUpgradeRequestDetailRoute({ params }: { params: { id: string } }) {
  return <AdminUpgradeRequestDetailPage id={params.id} />;
}
