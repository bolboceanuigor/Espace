import { ClientRevenueForecastPage } from '@/components/superadmin/RevenueOperationsPages';

export default function Page({ params }: { params: { clientId: string } }) {
  return <ClientRevenueForecastPage clientId={params.clientId} />;
}
