import { RevenueCollectionsPage } from '@/components/superadmin/RevenueOperationsPages';

export default function Page() {
  return <RevenueCollectionsPage params={{ followUpDue: 'true' }} />;
}
