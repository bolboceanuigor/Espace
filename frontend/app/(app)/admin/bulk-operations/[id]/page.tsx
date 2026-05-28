import { BulkOperationDetailPage } from '@/components/bulk-operations/BulkOperationPages';

export default function AdminBulkOperationDetailRoute({ params }: { params: { id: string } }) {
  return <BulkOperationDetailPage id={params.id} />;
}
