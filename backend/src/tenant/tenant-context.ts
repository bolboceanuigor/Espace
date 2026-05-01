import { AsyncLocalStorage } from 'async_hooks';

/**
 * Request-scoped tenant context for Prisma middleware.
 * When set (tenant flows), organizationId is injected into queries for Property, Reservation, Client, Subscription, Invoice.
 * When null/undefined (Admin/Sales or unauthenticated), no injection happens.
 */
export interface TenantContextValue {
  organizationId: string;
}

export const tenantStorage = new AsyncLocalStorage<TenantContextValue | null>();

export function getTenantOrganizationId(): string | null {
  return tenantStorage.getStore()?.organizationId ?? null;
}
