export type OwnerResidentLike = {
  role?: string | null;
  apartments?: Array<{ role?: string | null }> | null;
};

export function isOwnerResidentRow(row: OwnerResidentLike | null | undefined) {
  if (!row) return false;
  const directRole = String(row.role || '').toUpperCase();
  if (directRole === 'OWNER') return true;
  return (row.apartments || []).some((apartment) => String(apartment?.role || '').toUpperCase() === 'OWNER');
}
