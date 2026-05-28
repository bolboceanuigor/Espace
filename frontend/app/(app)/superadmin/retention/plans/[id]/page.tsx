import { RetentionPlanDetailPage } from '@/components/superadmin/RetentionPages';

export default function Page({ params }: { params: { id: string } }) {
  return <RetentionPlanDetailPage id={params.id} />;
}
