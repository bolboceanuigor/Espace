'use client';

import { filesApi } from '@/lib/api';

type Props = {
  files: Array<{
    id: string;
    fileAssetId?: string;
    fileName: string;
    fileUrl?: string;
    mimeType?: string;
    sizeBytes?: number;
    createdAt?: string;
  }>;
  onDelete?: (id: string) => Promise<void>;
};

export default function FileList({ files, onDelete }: Props) {
  return (
    <div className="space-y-2">
      {files.map((row) => (
        <div key={row.id} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
          <div className="min-w-0">
            <a href={row.fileAssetId ? filesApi.secureDownloadUrl(row.fileAssetId) : row.fileUrl} target="_blank" rel="noreferrer" className="truncate text-sm text-primary underline">
              {row.fileName}
            </a>
            <p className="text-xs text-muted-foreground">
              {row.mimeType || '-'} {typeof row.sizeBytes === 'number' ? `• ${(row.sizeBytes / 1024 / 1024).toFixed(2)} MB` : ''}
            </p>
          </div>
          {onDelete ? (
            <button className="text-xs text-rose-600" onClick={() => onDelete(row.id)}>
              Delete
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

