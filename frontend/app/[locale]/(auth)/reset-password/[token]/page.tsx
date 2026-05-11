import { ResetPasswordPageContent } from '@/components/auth/AccountRecoveryPages';

export default function ResetPasswordTokenPage({ params }: { params: { locale: string; token: string } }) {
  return <ResetPasswordPageContent locale={params.locale} token={params.token} />;
}
