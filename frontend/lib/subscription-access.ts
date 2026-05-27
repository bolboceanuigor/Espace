export function isWriteBlockedBySubscription(status: string | null | undefined): boolean {
  const normalized = String(status || '').toUpperCase();
  return ['SUSPENDED', 'CANCELLED', 'EXPIRED'].includes(normalized);
}

export function isAdminHardBlocked(status: string | null | undefined): boolean {
  const normalized = String(status || '').toUpperCase();
  return ['SUSPENDED', 'CANCELLED', 'EXPIRED'].includes(normalized);
}
