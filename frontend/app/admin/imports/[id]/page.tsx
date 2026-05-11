import { AdminImportDetailsPage } from '@/components/imports/AdminImportsPages';

export default function Page({ params }: { params: { id: string } }) {
  return <AdminImportDetailsPage id={params.id} />;
}
