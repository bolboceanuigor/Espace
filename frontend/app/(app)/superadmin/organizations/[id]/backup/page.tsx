'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { exportsApi } from '@/lib/api';
import { downloadBlob } from '@/lib/download';

export default function SuperadminOrganizationBackupPage() {
  const params = useParams<{ id: string }>();
  const orgId = params?.id || '';
  const [includeAuditLogs, setIncludeAuditLogs] = useState(true);
  const [loading, setLoading] = useState(false);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-foreground">Organization backup</h1>
      <p className="text-sm text-muted-foreground">Organization ID: {orgId}</p>

      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        Backup export includes sensitive resident and financial data. Handle file securely.
      </div>

      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={includeAuditLogs}
          onChange={(event) => setIncludeAuditLogs(event.target.checked)}
        />
        Include audit logs
      </label>

      <button
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white"
        disabled={loading || !orgId}
        onClick={async () => {
          setLoading(true);
          try {
            const blob = (await exportsApi.exportSuperadminOrganizationBackup(orgId, includeAuditLogs)).data;
            downloadBlob(blob, `organization-${orgId}-backup.json`);
          } finally {
            setLoading(false);
          }
        }}
      >
        {loading ? 'Exporting...' : 'Export selected organization data'}
      </button>
    </div>
  );
}

