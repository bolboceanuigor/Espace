import { RetentionPolicyDetailsPage } from '@/components/superadmin/data-retention/DataRetentionPages';

export default function Page({ params }: { params: { id: string } }) {
  return <RetentionPolicyDetailsPage params={params} />;
}
