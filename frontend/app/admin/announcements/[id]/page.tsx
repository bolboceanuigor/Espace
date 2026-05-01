'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Eye, EyeOff, MessageCircle, Trash2 } from 'lucide-react';
import { communicationsApi } from '@/lib/api';

export default function AdminAnnouncementDetailsPage() {
  const params = useParams<{ id: string }>();
  const [announcement, setAnnouncement] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);

  const load = async () => {
    const [announcementsRes, commentsRes] = await Promise.all([
      communicationsApi.listAdminAnnouncements(),
      communicationsApi.listAdminAnnouncementComments(params.id),
    ]);
    const current = (announcementsRes.data || []).find((item: any) => item.id === params.id) || null;
    setAnnouncement(current);
    setComments(commentsRes.data || []);
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, [params.id]);

  if (!announcement) return <div className="text-sm text-muted-foreground">Loading announcement...</div>;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/70 bg-card p-4">
        <h1 className="text-xl font-semibold text-foreground">{announcement.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{announcement.content}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          {announcement.importance} • {announcement.targetType} • {new Date(announcement.createdAt).toLocaleString()}
        </p>
      </div>

      <div className="rounded-xl border border-border/70 bg-card p-4">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">Comentarii ({comments.length})</p>
        </div>
        <div className="mt-3 space-y-2">
          {comments.map((comment) => (
            <div key={comment.id} className="rounded-lg border border-border/60 p-3">
              <p className="text-xs text-muted-foreground">
                {(comment.user?.firstName || '').trim()} {(comment.user?.lastName || '').trim()}
                {!comment.user?.firstName && !comment.user?.lastName ? comment.user?.email || 'Locatar' : ''}
                {comment.user?.residentProfiles?.[0]?.apartment?.number
                  ? ` • Ap. ${comment.user.residentProfiles[0].apartment.number}`
                  : ''}
                {' • '}
                {new Date(comment.createdAt).toLocaleString()}
                {' • '}
                {comment.status}
              </p>
              <p className="mt-1 text-sm text-foreground">{comment.content}</p>
              <div className="mt-2 flex gap-3 text-xs">
                {comment.status === 'HIDDEN' ? (
                  <button
                    className="inline-flex items-center gap-1 text-emerald-600"
                    onClick={async () => {
                      await communicationsApi.showAdminAnnouncementComment(comment.id);
                      await load();
                    }}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Show
                  </button>
                ) : (
                  <button
                    className="inline-flex items-center gap-1 text-amber-600"
                    onClick={async () => {
                      await communicationsApi.hideAdminAnnouncementComment(comment.id);
                      await load();
                    }}
                  >
                    <EyeOff className="h-3.5 w-3.5" />
                    Hide
                  </button>
                )}
                <button
                  className="inline-flex items-center gap-1 text-rose-600"
                  onClick={async () => {
                    await communicationsApi.deleteAdminAnnouncementComment(comment.id);
                    await load();
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </div>
            </div>
          ))}
          {!comments.length ? <p className="text-sm text-muted-foreground">Nu exista comentarii.</p> : null}
        </div>
      </div>
    </div>
  );
}
