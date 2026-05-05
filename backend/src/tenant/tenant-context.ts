import { AsyncLocalStorage } from 'async_hooks';

/**
 * Request-scoped tenant context for Prisma middleware.
 * When set, organizationId is available to scope condominium organization queries.
 * When null/undefined (Admin/Sales or unauthenticated), no injection happens.
 */
export interface TenantContextValue {
  organizationId: string;
}

export const tenantStorage = new AsyncLocalStorage<TenantContextValue | null>();

export function getTenantOrganizationId(): string | null {
  return tenantStorage.getStore()?.organizationId ?? null;
}
