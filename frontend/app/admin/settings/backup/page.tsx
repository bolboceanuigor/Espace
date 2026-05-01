'use client';

import { useState } from 'react';
import { exportsApi } from '@/lib/api';
import { downloadBlob } from '@/lib/download';

export default function AdminBackupSettingsPage() {
  const [includeAuditLogs, setIncludeAuditLogs] = useState(false);
  const [loading, setLoading] = useState(false);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-foreground">Organization backup export</h1>

      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        Export contains sensitive resident and financial data.
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
        disabled={loading}
        onClick={async () => {
          setLoading(true);
          try {
            const blob = (await exportsApi.exportAdminBackup(includeAuditLogs)).data;
            downloadBlob(blob, 'organization-backup.json');
          } finally {
            setLoading(false);
          }
        }}
      >
        {loading ? 'Exporting...' : 'Export organization data'}
      </button>
    </div>
  );
}

