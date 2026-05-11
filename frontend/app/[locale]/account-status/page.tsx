import { AccountStatusPageContent } from '@/components/auth/AccountRecoveryPages';

export default function AccountStatusPage({ params }: { params: { locale: string } }) {
  return <AccountStatusPageContent locale={params.locale} />;
}
