import { OnlinePaymentProviderType, PaymentProvider } from '@prisma/client';
import {
  areExternalPaymentsEnabled,
  isExternalPaymentProvider,
  isExternalPaymentProviderType,
  isLegacyAdminPermissionFallbackEnabled,
} from './runtime-flags';

describe('runtime flags', () => {
  it('keeps external payments disabled by default', () => {
    expect(areExternalPaymentsEnabled({} as NodeJS.ProcessEnv)).toBe(false);
  });

  it('enables external payments only when the flag is true', () => {
    expect(areExternalPaymentsEnabled({ PAYMENTS_EXTERNAL_ENABLED: 'true' } as NodeJS.ProcessEnv)).toBe(true);
    expect(areExternalPaymentsEnabled({ PAYMENTS_EXTERNAL_ENABLED: 'false' } as NodeJS.ProcessEnv)).toBe(false);
  });

  it('allows legacy admin permission fallback only outside production and with explicit flag', () => {
    expect(
      isLegacyAdminPermissionFallbackEnabled({
        NODE_ENV: 'development',
        ALLOW_LEGACY_ADMIN_PERMISSION_FALLBACK: 'true',
      } as NodeJS.ProcessEnv),
    ).toBe(true);
    expect(
      isLegacyAdminPermissionFallbackEnabled({
        NODE_ENV: 'production',
        ALLOW_LEGACY_ADMIN_PERMISSION_FALLBACK: 'true',
      } as NodeJS.ProcessEnv),
    ).toBe(false);
    expect(
      isLegacyAdminPermissionFallbackEnabled({
        NODE_ENV: 'development',
        ALLOW_LEGACY_ADMIN_PERMISSION_FALLBACK: 'false',
      } as NodeJS.ProcessEnv),
    ).toBe(false);
  });

  it('marks only real providers as external', () => {
    expect(isExternalPaymentProvider(PaymentProvider.MAIB)).toBe(true);
    expect(isExternalPaymentProvider(PaymentProvider.PAYNET)).toBe(true);
    expect(isExternalPaymentProvider(PaymentProvider.OPLATA)).toBe(true);
    expect(isExternalPaymentProvider(PaymentProvider.CASH)).toBe(false);
    expect(isExternalPaymentProvider(PaymentProvider.MANUAL_BANK_TRANSFER)).toBe(false);
    expect(isExternalPaymentProviderType(OnlinePaymentProviderType.BPAY)).toBe(true);
    expect(isExternalPaymentProviderType(OnlinePaymentProviderType.MANUAL_TEST)).toBe(false);
  });
});
