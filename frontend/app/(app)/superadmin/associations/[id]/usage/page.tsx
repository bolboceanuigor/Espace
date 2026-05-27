import { SuperadminAssociationUsagePage } from '@/components/superadmin/SaasUsagePages';

export default function SuperadminAssociationUsageRoute({ params }: { params: { id: string } }) {
  return <SuperadminAssociationUsagePage id={params.id} />;
}
