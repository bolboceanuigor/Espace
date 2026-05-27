import { SuperadminUpgradeRequestsPage } from '@/components/superadmin/SaasUpgradeRequestPages';

export default function SuperadminAssociationUpgradeRequestsRoute({ params }: { params: { id: string } }) {
  return <SuperadminUpgradeRequestsPage associationId={params.id} />;
}
