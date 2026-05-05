'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { MessageCircle, Pencil, Trash2 } from 'lucide-react';
import { communicationsApi } from '@/lib/api';
import MobilePageHeader from '@/components/common/MobilePageHeader';
import LoadingState from '@/components/common/LoadingState';
import EmptyState from '@/components/common/EmptyState';

export default function ResidentAnnouncementDetailsPage() {
  const params = useParams<{ id: string }>();
  const [announcement, setAnnouncement] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [content, setContent] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [announcementRes, commentsRes] = await Promise.all([
        communicationsApi.getResidentAnnouncement(params.id),
        communicationsApi.listResidentAnnouncementComments(params.id),
      ]);
      setAnnouncement(announcementRes.data || null);
      setComments(commentsRes.data || []);
    } catch {
      setError('Nu am putut încărca anunțul.');
      setAnnouncement(null);
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <LoadingState label="Se încarcă anunțul..." />;
  if (error) {
    return (
      <div className="space-y-4 pb-24 md:pb-4">
        <MobilePageHeader title="Detalii anunț" subtitle="Comentarii și discuții" showBackButton />
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}{' '}
          <button className="underline" onClick={() => load().catch(() => undefined)}>
            Reîncearcă
          </button>
        </div>
      </div>
    );
  }
  if (!announcement) {
    return (
      <div className="space-y-4 pb-24 md:pb-4">
        <MobilePageHeader title="Detalii anunț" subtitle="Comentarii și discuții" showBackButton />
        <EmptyState title="Anunțul nu este disponibil" description="Poate a fost șters sau nu mai ai acces la el." />
      </div>
    );
  }

  return (
    <div className="space-y-4 overflow-x-hidden pb-24 md:pb-4">
      <MobilePageHeader title="Detalii anunț" subtitle="Comentarii și discuții" showBackButton />
      <div className="rounded-xl border border-border/70 bg-card p-4">
        <h1 className="text-xl font-semibold text-foreground">{announcement.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{announcement.content}</p>
        <p className="mt-2 text-xs text-muted-foreground">{new Date(announcement.createdAt).toLocaleString()}</p>
      </div>

      <div className="rounded-xl border border-border/70 bg-card p-4">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">Comentarii comunitate</p>
        </div>
        {!announcement.commentsEnabled ? (
          <p className="mt-2 text-xs text-muted-foreground">Comentariile sunt dezactivate pentru acest anunț.</p>
        ) : null}

        <div className="mt-3 space-y-2">
          {comments.map((comment) => (
            <div key={comment.id} className="rounded-lg border border-border/60 p-3">
              <p className="text-xs text-muted-foreground">
                {comment.author?.displayName || 'Locatar'}
                {comment.author?.apartmentNumber ? ` • Ap. ${comment.author.apartmentNumber}` : ''}
                {' • '}
                {new Date(comment.createdAt).toLocaleString()}
              </p>
              {editingId === comment.id ? (
                <div className="mt-2 space-y-2">
                  <textarea
                    className="input min-h-[80px]"
                    value={editingContent}
                    onChange={(event) => setEditingContent(event.target.value)}
                  />
                  <div className="flex gap-2">
                    <button
                      className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white"
                      onClick={async () => {
                        await communicationsApi.updateResidentAnnouncementComment(comment.id, { content: editingContent });
                        setEditingId(null);
                        setEditingContent('');
                        await load();
                      }}
                    >
                      Salveaza
                    </button>
                    <button className="rounded-md border border-border px-3 py-1.5 text-xs" onClick={() => setEditingId(null)}>
                      Renunta
                    </button>
                  </div>
                </div>
              ) : (
                <p className="mt-1 text-sm text-foreground">{comment.content}</p>
              )}
              {comment.isOwn ? (
                <div className="mt-2 flex gap-3 text-xs">
                  <button
                    className="inline-flex items-center gap-1 text-primary"
                    onClick={() => {
                      setEditingId(comment.id);
                      setEditingContent(comment.content);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Editeaza
                  </button>
                  <button
                    className="inline-flex items-center gap-1 text-rose-600"
                    onClick={async () => {
                      await communicationsApi.deleteResidentAnnouncementComment(comment.id);
                      await load();
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Sterge
                  </button>
                </div>
              ) : null}
            </div>
          ))}
          {!comments.length ? <p className="text-sm text-muted-foreground">Nu exista comentarii.</p> : null}
        </div>

        {announcement.commentsEnabled ? (
          <>
            <textarea
              className="input mt-3 min-h-[90px]"
              placeholder="Adauga un comentariu"
              value={content}
              onChange={(event) => setContent(event.target.value)}
            />
            <button
              className="mt-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white"
              onClick={async () => {
                await communicationsApi.createResidentAnnouncementComment(announcement.id, { content });
                setContent('');
                await load();
              }}
            >
              Trimite comentariu
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
