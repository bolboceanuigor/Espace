import { OnlinePaymentProviderType, PaymentProvider } from '@prisma/client';

function isEnabled(value: string | undefined, fallback = false) {
  if (value === undefined) return fallback;
  return value.toLowerCase() === 'true';
}

export function areExternalPaymentsEnabled(env: NodeJS.ProcessEnv = process.env) {
  return isEnabled(env.PAYMENTS_EXTERNAL_ENABLED, false);
}

export function isLegacyAdminPermissionFallbackEnabled(env: NodeJS.ProcessEnv = process.env) {
  return env.NODE_ENV !== 'production' && isEnabled(env.ALLOW_LEGACY_ADMIN_PERMISSION_FALLBACK, false);
}

export function isExternalPaymentProviderType(type: OnlinePaymentProviderType | null | undefined) {
  return Boolean(type && type !== OnlinePaymentProviderType.MANUAL_TEST);
}

export function isExternalPaymentProvider(provider: PaymentProvider | null | undefined) {
  return provider === PaymentProvider.MAIB || provider === PaymentProvider.PAYNET || provider === PaymentProvider.OPLATA;
}
