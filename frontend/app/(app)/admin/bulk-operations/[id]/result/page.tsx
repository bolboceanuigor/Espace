import { BulkOperationDetailPage } from '@/components/bulk-operations/BulkOperationPages';

export default function AdminBulkOperationResultRoute({ params }: { params: { id: string } }) {
  return <BulkOperationDetailPage id={params.id} view="result" />;
}
