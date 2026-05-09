export const APARTMENT_IMPORT_SAMPLE_ROWS = [
  ['scara', 'apartament', 'etaj', 'suprafata_m2', 'camere', 'proprietar_prenume', 'proprietar_nume', 'telefon', 'email', 'rol', 'observatii'],
  ['2', '45', '6', '72.4', '3', 'Ion', 'Popescu', '+37360000000', 'ion@example.com', 'OWNER', ''],
  ['1', '12', '3', '48.2', '2', 'Elena', 'Rusu', '+37361111111', 'elena@example.com', 'OWNER', ''],
];

export function buildApartmentImportCsvTemplate() {
  return APARTMENT_IMPORT_SAMPLE_ROWS
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

export function downloadApartmentImportCsvTemplate() {
  const csv = `\ufeff${buildApartmentImportCsvTemplate()}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'model-import-apartamente.csv';
  link.click();
  URL.revokeObjectURL(url);
}
