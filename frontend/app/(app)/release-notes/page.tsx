'use client';

import { useEffect, useState } from 'react';
import { releaseNotesApi } from '@/lib/api';

export default function ReleaseNotesPage() {
  const [rows, setRows] = useState<any[]>([]);

  const load = async () => {
    const res = await releaseNotesApi.list();
    setRows(res.data || []);
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/70 bg-card p-4">
        <h1 className="text-lg font-semibold text-foreground">Release notes</h1>
        <p className="mt-1 text-sm text-muted-foreground">Latest features, fixes and improvements.</p>
      </div>

      <div className="space-y-2">
        {rows.map((note) => {
          const isRead = !!note.releaseReads?.length;
          return (
            <div key={note.id} className="rounded-xl border border-border/70 bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">
                  {note.title} {note.version ? <span className="text-xs text-muted-foreground">({note.version})</span> : null}
                </p>
                <div className="flex items-center gap-2">
                  {!isRead ? (
                    <span className="rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-xs text-primary">unread</span>
                  ) : null}
                  <span className="rounded-md border border-border/70 px-2 py-1 text-xs text-muted-foreground">
                    {new Date(note.publishedAt || note.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{note.content}</p>
              {!isRead ? (
                <button
                  className="mt-3 rounded-md border border-border/70 px-3 py-1.5 text-xs"
                  onClick={async () => {
                    await releaseNotesApi.markRead(note.id);
                    await load();
                  }}
                >
                  Mark as read
                </button>
              ) : null}
            </div>
          );
        })}
        {!rows.length ? <p className="text-sm text-muted-foreground">No release notes yet.</p> : null}
      </div>
    </div>
  );
}
