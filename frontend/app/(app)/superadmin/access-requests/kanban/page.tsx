import { CustomerRequestsListPage } from '@/components/superadmin/customer-requests/CustomerRequestPages';

export default function SuperadminAccessRequestsKanbanPage() {
  return <CustomerRequestsListPage kanban basePath="/superadmin/access-requests" />;
}
