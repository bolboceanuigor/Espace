import { SessionExpiredPageContent } from '@/components/auth/AccountRecoveryPages';

export default function ResidentSessionExpiredPage({ params }: { params: { locale: string } }) {
  return <SessionExpiredPageContent locale={params.locale} />;
}
