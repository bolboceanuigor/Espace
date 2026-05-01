'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { reconciliationApi } from '@/lib/api';

const LOGICAL_FIELDS: Array<{ key: string; label: string; required?: boolean }> = [
  { key: 'amount', label: 'Amount', required: true },
  { key: 'paymentDate', label: 'Payment Date', required: true },
  { key: 'transactionType', label: 'Transaction Type' },
  { key: 'payerName', label: 'Payer Name' },
  { key: 'payerIban', label: 'Payer IBAN' },
  { key: 'apartmentNumber', label: 'Apartment Number' },
  { key: 'buildingName', label: 'Building Name' },
  { key: 'invoiceNumber', label: 'Invoice Number' },
  { key: 'accountNumber', label: 'Account Number' },
  { key: 'referenceNumber', label: 'Reference Number' },
  { key: 'currency', label: 'Currency' },
  { key: 'description', label: 'Description' },
];

export default function ReconciliationMappingPage() {
  const params = useParams<{ batchId: string }>();
  const router = useRouter();
  const [headers, setHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<Array<Record<string, any>>>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    reconciliationApi
      .getBatchHeaders(params.batchId)
      .then((res) => {
        const data = res.data || {};
        setHeaders(data.headers || []);
        setPreviewRows(data.previewRows || []);
        setMapping(data.mappingJson || data.defaultTemplate?.mappingJson || data.autoMapping || {});
      })
      .catch(() => undefined);
  }, [params.batchId]);

  const missingRequired = useMemo(
    () => LOGICAL_FIELDS.filter((f) => f.required && !mapping[f.key]).map((f) => f.label),
    [mapping],
  );

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-foreground">Column Mapping</h1>
      {missingRequired.length ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Required fields missing: {missingRequired.join(', ')}
        </div>
      ) : null}
      <div className="rounded-xl border border-border/70 bg-card p-4">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {LOGICAL_FIELDS.map((field) => (
            <label key={field.key} className="space-y-1 text-sm">
              <span className="text-foreground">
                {field.label}
                {field.required ? ' *' : ''}
              </span>
              <select
                className="select"
                value={mapping[field.key] || ''}
                onChange={(e) => setMapping((prev) => ({ ...prev, [field.key]: e.target.value }))}
              >
                <option value="">Not mapped</option>
                {headers.map((header) => (
                  <option key={header} value={header}>
                    {header}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <div className="mt-3 space-y-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={saveAsTemplate} onChange={(e) => setSaveAsTemplate(e.target.checked)} />
            Save mapping as template
          </label>
          {saveAsTemplate ? (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <input
                className="input"
                placeholder="Template name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
              />
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
                Set as default for this source
              </label>
            </div>
          ) : null}
        </div>
        <button
          className="mt-3 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          disabled={loading || missingRequired.length > 0}
          onClick={async () => {
            setLoading(true);
            try {
              await reconciliationApi.applyBatchMapping(params.batchId, {
                mappingJson: mapping,
                saveAsTemplate,
                templateName: templateName || undefined,
                isDefault,
              });
              router.push(`/admin/reconciliation/${params.batchId}`);
            } finally {
              setLoading(false);
            }
          }}
        >
          {loading ? 'Applying...' : 'Apply mapping'}
        </button>
      </div>

      <div className="rounded-xl border border-border/70 bg-card p-4">
        <p className="mb-2 text-sm font-medium text-foreground">Preview (first 10 rows)</p>
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border/60">
                {headers.map((header) => (
                  <th key={header} className="py-2 pr-2">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row, idx) => (
                <tr key={idx} className="border-b border-border/50">
                  {headers.map((header) => (
                    <td key={`${idx}-${header}`} className="py-2 pr-2">
                      {String(row[header] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

