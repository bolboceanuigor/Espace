import { redirect } from 'next/navigation';

export default function ResetPasswordQueryPage({ searchParams }: { searchParams: { token?: string } }) {
  if (searchParams.token) {
    redirect(`/ro/reset-password/${encodeURIComponent(searchParams.token)}`);
  }
  redirect('/ro/forgot-password');
}
