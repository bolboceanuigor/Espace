import { SuperadminUpgradeRequestDetailPage } from '@/components/superadmin/SaasUpgradeRequestPages';

export default function SuperadminUpgradeRequestDetailRoute({ params }: { params: { id: string } }) {
  return <SuperadminUpgradeRequestDetailPage id={params.id} />;
}
