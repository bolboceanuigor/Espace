import { CustomerRequestsListPage } from '@/components/superadmin/customer-requests/CustomerRequestPages';

export default function SuperadminAccessRequestsPage() {
  return (
    <CustomerRequestsListPage
      basePath="/superadmin/access-requests"
      title="Cereri acces"
      subtitle="Proceseaza cererile primite prin formularul Cere acces."
    />
  );
}
