import { ResetPasswordPageContent } from '@/components/auth/AccountRecoveryPages';

export default function ResetPasswordTokenPage({ params }: { params: { token: string } }) {
  return <ResetPasswordPageContent locale="ro" token={params.token} />;
}
