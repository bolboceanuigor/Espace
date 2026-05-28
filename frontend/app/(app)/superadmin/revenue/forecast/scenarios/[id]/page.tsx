import { RevenueForecastScenariosPage } from '@/components/superadmin/RevenueOperationsPages';

export default function Page({ params }: { params: { id: string } }) {
  return <RevenueForecastScenariosPage id={params.id} />;
}
