import { BillingCurrency, PaymentProvider } from '@prisma/client';

export type ProviderIntentInput = {
  organizationId: string;
  paymentIntentId: string;
  amount: number;
  currency: BillingCurrency;
  apartmentId: string;
  invoiceId?: string | null;
  metadata?: Record<string, any>;
};

export type ProviderIntentResult = {
  status: 'CREATED' | 'REDIRECTED' | 'FAILED';
  redirectUrl?: string;
  providerPaymentId?: string;
  message?: string;
};

export type ProviderStatusResult = {
  status: 'CREATED' | 'REDIRECTED' | 'PAID' | 'FAILED' | 'EXPIRED' | 'CANCELLED';
  providerPaymentId?: string;
  message?: string;
};

export interface PaymentProviderAdapter {
  readonly provider: PaymentProvider;
  createPaymentIntent(input: ProviderIntentInput): Promise<ProviderIntentResult>;
  getPaymentStatus(providerPaymentId: string): Promise<ProviderStatusResult>;
  handleWebhook(payload: any, headers?: Record<string, any>): Promise<ProviderStatusResult>;
  refundPayment?(providerPaymentId: string, amount?: number): Promise<{ ok: boolean; message?: string }>;
}

