import { ChurnRiskDetailPage } from '@/components/superadmin/RetentionPages';

export default function Page({ params }: { params: { id: string } }) {
  return <ChurnRiskDetailPage id={params.id} />;
}
