import { AdminInvitationPage } from '@/components/admin-handover/AdminInvitationPage';
import { defaultLocale, isLocale } from '@/i18n';

export default function LocalizedAdminInvitationPage({
  params,
}: {
  params: { locale?: string; token?: string };
}) {
  const localeParam = params.locale || '';
  const locale = isLocale(localeParam) ? localeParam : defaultLocale;
  return <AdminInvitationPage token={params.token || ''} locale={locale} />;
}
