import { DataExportDetailsPage } from '@/components/data-export/DataExportPages';

export default function Page({ params }: { params: { id: string } }) {
  return <DataExportDetailsPage scope="admin" params={params} />;
}
