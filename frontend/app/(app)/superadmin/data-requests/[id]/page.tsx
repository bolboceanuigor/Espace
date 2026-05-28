import { DataRequestDetailsPage } from '@/components/data-export/DataExportPages';

export default function Page({ params }: { params: { id: string } }) {
  return <DataRequestDetailsPage scope="superadmin" params={params} />;
}
