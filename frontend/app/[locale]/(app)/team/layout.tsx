import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { defaultLocale, isLocale } from '@/i18n';
import { normalizeRole, roleHomePath } from '@/lib/role-routing';

type TeamLayoutProps = {
  children: React.ReactNode;
  params: { locale: string };
};

function getRoleFromToken(token: string): string | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const decoded = Buffer.from(payload, 'base64url').toString('utf8');
    const data = JSON.parse(decoded) as { role?: string };
    return (data.role || '').toUpperCase() || null;
  } catch {
    return null;
  }
}

export default function TeamLayout({ children, params }: TeamLayoutProps) {
  const token = cookies().get('accessToken')?.value;
  const locale = isLocale(params.locale) ? params.locale : defaultLocale;

  if (!token) {
    redirect('/login');
  }

  const role = normalizeRole(getRoleFromToken(token));
  if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
    redirect(`/${locale}${roleHomePath(role)}`);
  }

  return children;
}
