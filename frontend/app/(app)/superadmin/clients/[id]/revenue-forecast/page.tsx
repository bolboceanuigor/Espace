import { ClientRevenueForecastPage } from '@/components/superadmin/RevenueOperationsPages';

export default function Page({ params }: { params: { id: string } }) {
  return <ClientRevenueForecastPage clientId={params.id} />;
}
