import { PlaybookDetailPage } from '@/components/superadmin/clients/CustomerSuccessPages';

export default function Page({ params }: { params: { id: string } }) {
  return <PlaybookDetailPage id={params.id} />;
}
