'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import FileUploadField from '@/components/files/FileUploadField';
import { filesApi, issuesApi } from '@/lib/api';

export default function ResidentIssueDetailsPage() {
  const params = useParams<{ id: string }>();
  const [row, setRow] = useState<any>(null);
  const [comment, setComment] = useState('');

  const load = async () => {
    const res = await issuesApi.residentGetOne(params.id);
    setRow(res.data);
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, [params.id]);

  if (!row) return <div className="text-sm text-muted-foreground">Loading issue...</div>;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/70 bg-card p-4">
        <h1 className="text-xl font-semibold text-foreground">{row.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{row.description}</p>
        <div className="mt-2 text-xs text-muted-foreground">
          {row.status} • {row.priority} • {row.category} • {row.locationType}
        </div>
      </div>

      <div className="rounded-xl border border-border/70 bg-card p-4">
        <p className="text-sm font-medium text-foreground">Timeline / Comentarii</p>
        <div className="mt-2 space-y-2">
          {(row.comments || []).map((entry: any) => (
            <div key={entry.id} className="rounded-lg border border-border/60 p-2">
              <p className="text-xs text-muted-foreground">
                {entry.user?.firstName || entry.user?.email || 'User'} • {new Date(entry.createdAt).toLocaleString()}
              </p>
              <p className="text-sm text-foreground">{entry.message}</p>
            </div>
          ))}
        </div>
        <textarea className="input mt-3 min-h-[90px]" placeholder="Adauga comentariu" value={comment} onChange={(e) => setComment(e.target.value)} />
        <button
          className="mt-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white"
          onClick={async () => {
            await issuesApi.residentAddComment(row.id, { message: comment });
            setComment('');
            await load();
          }}
        >
          Trimite comentariu
        </button>
      </div>

      <div className="rounded-xl border border-border/70 bg-card p-4">
        <p className="text-sm font-medium text-foreground">Atasamente</p>
        <div className="mt-2">
          <FileUploadField
            label="Incarca atasament"
            accept=".pdf,image/*"
            onUpload={async (file) => {
              const upload = await filesApi.residentUpload(file, { entityType: 'ISSUE_ATTACHMENT', entityId: row.id });
              await issuesApi.residentAddAttachment(row.id, {
                fileUrl: upload.data.fileUrl,
                fileName: upload.data.fileName,
                fileType: upload.data.mimeType,
              });
              await load();
            }}
          />
        </div>
        <div className="mt-2 space-y-1">
          {(row.attachments || []).map((entry: any) => (
            <a key={entry.id} href={entry.fileAssetId ? filesApi.secureDownloadUrl(entry.fileAssetId) : entry.fileUrl} target="_blank" className="block text-sm text-primary underline">
              {entry.fileName}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
