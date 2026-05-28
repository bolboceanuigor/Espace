import { BulkOperationDetailPage } from '@/components/bulk-operations/BulkOperationPages';

export default function AdminBulkOperationPreviewRoute({ params }: { params: { id: string } }) {
  return <BulkOperationDetailPage id={params.id} view="preview" />;
}
