'use client';

import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { communicationsApi, filesApi } from '@/lib/api';
import LoadingState from '@/components/common/LoadingState';
import ResponsiveList from '@/components/common/ResponsiveList';
import MobilePageHeader from '@/components/common/MobilePageHeader';

export default function ResidentDocumentsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    communicationsApi
      .listResidentDocuments()
      .then((res) => setRows(res.data || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState label="Loading documents..." />;

  return (
    <div className="space-y-4">
      <MobilePageHeader title="Documents" subtitle="Official documents available for your apartment." />
      <ResponsiveList
        items={rows}
        keyExtractor={(row) => row.id}
        emptyTitle="No documents available."
        renderCard={(row) => (
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">{row.title}</p>
            <p className="text-xs text-muted-foreground">{row.description || '-'}</p>
            <p className="text-xs text-muted-foreground">
              {row.fileType} • {new Date(row.createdAt).toLocaleDateString()}
            </p>
            <a
              className="mt-2 inline-flex min-h-10 items-center gap-1 rounded-md border border-border/70 px-3 text-sm text-primary"
              href={row.fileAssetId ? filesApi.secureDownloadUrl(row.fileAssetId) : row.fileUrl}
              target="_blank"
              rel="noreferrer"
            >
              <Download className="h-4 w-4" /> Download
            </a>
          </div>
        )}
        renderDesktopHeader={
          <div className="grid grid-cols-5 gap-2">
            <span>Title</span><span>Description</span><span>Type</span><span>Date</span><span>Download</span>
          </div>
        }
        renderDesktopRow={(row) => (
          <div className="grid grid-cols-5 gap-2 rounded-lg border border-border/60 px-2 py-2 text-sm text-foreground">
            <span>{row.title}</span>
            <span className="truncate">{row.description || '-'}</span>
            <span>{row.fileType}</span>
            <span>{new Date(row.createdAt).toLocaleDateString()}</span>
            <a className="inline-flex items-center gap-1 text-primary underline" href={row.fileAssetId ? filesApi.secureDownloadUrl(row.fileAssetId) : row.fileUrl} target="_blank" rel="noreferrer">
              <Download className="h-4 w-4" /> Download
            </a>
          </div>
        )}
      />
    </div>
  );
}
