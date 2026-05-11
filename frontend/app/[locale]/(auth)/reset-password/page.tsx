import { redirect } from 'next/navigation';

export default function ResetPasswordQueryPage({ params, searchParams }: { params: { locale: string }; searchParams: { token?: string } }) {
  if (searchParams.token) {
    redirect(`/${params.locale}/reset-password/${encodeURIComponent(searchParams.token)}`);
  }
  redirect(`/${params.locale}/forgot-password`);
}
