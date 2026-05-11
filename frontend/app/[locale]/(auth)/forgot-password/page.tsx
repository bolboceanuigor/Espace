import { ForgotPasswordPageContent } from '@/components/auth/AccountRecoveryPages';

export default function ForgotPasswordPage({ params }: { params: { locale: string } }) {
  return <ForgotPasswordPageContent locale={params.locale} />;
}
