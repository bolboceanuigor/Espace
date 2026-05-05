'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { filesApi, issuesApi, maintenanceApi } from '@/lib/api';

export default function AdminIssueDetailsPage() {
  const params = useParams<{ id: string }>();
  const [row, setRow] = useState<any>(null);
  const [comment, setComment] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [assignUser, setAssignUser] = useState('');

  const load = useCallback(async () => {
    const res = await issuesApi.adminGetOne(params.id);
    setRow(res.data);
    setAssignUser(res.data?.assignedToUserId || '');
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!row) return <div className="text-sm text-muted-foreground">Loading issue...</div>;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/70 bg-card p-4">
        <h1 className="text-xl font-semibold text-foreground">{row.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{row.description}</p>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
          <select className="select" value={row.status} onChange={async (e) => { await issuesApi.adminUpdate(row.id, { status: e.target.value }); await load(); }}>
            {['NEW', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED'].map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
          <select className="select" value={row.priority} onChange={async (e) => { await issuesApi.adminUpdate(row.id, { priority: e.target.value }); await load(); }}>
            {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
          <input
            className="input"
            placeholder="Assign user id"
            value={assignUser}
            onChange={(e) => setAssignUser(e.target.value)}
            onBlur={async () => {
              await issuesApi.adminUpdate(row.id, { assignedToUserId: assignUser || null });
              await load();
            }}
          />
        </div>
        <div className="mt-3">
          <button
            className="rounded-md border border-border/70 px-3 py-2 text-sm"
            onClick={async () => {
              await maintenanceApi.taskFromIssue(row.id, {});
              await load();
            }}
          >
            Create reactive maintenance task
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-border/70 bg-card p-4">
        <p className="text-sm font-medium text-foreground">Comentarii</p>
        <div className="mt-2 space-y-2">
          {(row.comments || []).map((entry: any) => (
            <div key={entry.id} className="rounded-lg border border-border/60 p-2">
              <p className="text-xs text-muted-foreground">
                {entry.user?.firstName || entry.user?.email || 'User'} • {new Date(entry.createdAt).toLocaleString()}
                {entry.isInternal ? ' • Internal' : ''}
              </p>
              <p className="text-sm text-foreground">{entry.message}</p>
            </div>
          ))}
        </div>
        <textarea className="input mt-3 min-h-[90px]" placeholder="Adauga comentariu" value={comment} onChange={(e) => setComment(e.target.value)} />
        <label className="mt-2 flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={isInternal} onChange={(e) => setIsInternal(e.target.checked)} />
          Internal comment
        </label>
        <button
          className="mt-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white"
          onClick={async () => {
            await issuesApi.adminAddComment(row.id, { message: comment, isInternal });
            setComment('');
            setIsInternal(false);
            await load();
          }}
        >
          Save comment
        </button>
      </div>

      <div className="rounded-xl border border-border/70 bg-card p-4">
        <p className="text-sm font-medium text-foreground">Atasamente</p>
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
