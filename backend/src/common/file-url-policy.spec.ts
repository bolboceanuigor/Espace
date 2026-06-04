import { assertInternalFileUrl, isInternalFileUrl } from './file-url-policy';

describe('file url policy', () => {
  it('accepts only internal file routes', () => {
    expect(isInternalFileUrl('/uploads/org/doc.pdf')).toBe(true);
    expect(isInternalFileUrl('/files/123/download')).toBe(true);
    expect(isInternalFileUrl('https://example.com/doc.pdf')).toBe(false);
    expect(isInternalFileUrl('http://example.com/doc.pdf')).toBe(false);
    expect(isInternalFileUrl('javascript:alert(1)')).toBe(false);
  });

  it('throws for external urls', () => {
    expect(() => assertInternalFileUrl('https://example.com/doc.pdf')).toThrow('Fișierul trebuie încărcat prin Espace.');
  });
});
