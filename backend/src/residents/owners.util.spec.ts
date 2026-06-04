import { isOwnerResidentRow } from './owners.util';

describe('isOwnerResidentRow', () => {
  it('returns true when the resident primary role is OWNER', () => {
    expect(isOwnerResidentRow({ role: 'OWNER', apartments: [] })).toBe(true);
  });

  it('returns true when at least one apartment relation is OWNER', () => {
    expect(
      isOwnerResidentRow({
        role: 'REPRESENTATIVE',
        apartments: [{ role: 'TENANT' }, { role: 'OWNER' }],
      }),
    ).toBe(true);
  });

  it('returns false for non-owner rows', () => {
    expect(
      isOwnerResidentRow({
        role: 'TENANT',
        apartments: [{ role: 'TENANT' }, { role: 'REPRESENTATIVE' }],
      }),
    ).toBe(false);
  });
});
