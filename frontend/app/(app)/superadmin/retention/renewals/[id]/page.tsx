import { RetentionRenewalDetailPage } from '@/components/superadmin/RetentionPages';

export default function Page({ params }: { params: { id: string } }) {
  return <RetentionRenewalDetailPage id={params.id} />;
}
