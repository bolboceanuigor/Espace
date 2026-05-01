'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useTranslations } from 'next-intl';
import { MessageCircle, Paperclip, Phone, Search, Smile } from 'lucide-react';
import { associationChatApi } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { getSocketBaseUrl, isApiConfigured } from '@/lib/runtime-config';
import { Button, PageHeader, useToast } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';

type ChatMessage = Awaited<ReturnType<typeof associationChatApi.sendMessage>>['data'];

const SOCKET_URL = getSocketBaseUrl();

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function senderInitials(message: ChatMessage) {
  const first = (message.sender.firstName || '').trim();
  const last = (message.sender.lastName || '').trim();
  if (first || last) return `${first[0] || ''}${last[0] || ''}`.toUpperCase();
  return message.sender.email.slice(0, 2).toUpperCase();
}

export default function AssociationChatPage() {
  const t = useTranslations('chat');
  const c = useTranslations('common');
  const { showToast } = useToast();
  const { user } = useAuth();
  const selfId = user?.id ?? null;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextBeforeId, setNextBeforeId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const sortedMessages = useMemo(
    () => [...messages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [messages],
  );

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      const container = listRef.current;
      if (!container) return;
      container.scrollTop = container.scrollHeight;
    });
  };

  const upsertMessage = (incoming: ChatMessage) => {
    setMessages((prev) => {
      const existingIndex = prev.findIndex((msg) => msg.id === incoming.id);
      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = incoming;
        return next;
      }
      return [...prev, incoming];
    });
  };

  const loadInitial = async () => {
    setLoading(true);
    if (!isApiConfigured()) {
      setMessages([]);
      setHasMore(false);
      setNextBeforeId(null);
      setLoading(false);
      return;
    }
    try {
      const res = await associationChatApi.listMessages({ limit: 70 });
      setMessages(res.data.items || []);
      setHasMore(!!res.data.hasMore);
      setNextBeforeId(res.data.nextBeforeId || null);
      scrollToBottom();
    } catch {
      showToast(c('error'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadOlder = async () => {
    if (!nextBeforeId || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const res = await associationChatApi.listMessages({ limit: 50, beforeId: nextBeforeId });
      const older = res.data.items || [];
      setMessages((prev) => [...older, ...prev]);
      setHasMore(!!res.data.hasMore);
      setNextBeforeId(res.data.nextBeforeId || null);
    } catch {
      showToast(c('error'), 'error');
    } finally {
      setLoadingOlder(false);
    }
  };

  const sendCurrentMessage = async () => {
    const text = draft.trim();
    if (!text || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    try {
      const res = await associationChatApi.sendMessage({ text });
      upsertMessage(res.data);
      setDraft('');
      scrollToBottom();
    } catch {
      showToast(c('error'), 'error');
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await sendCurrentMessage();
  };

  useEffect(() => {
    loadInitial().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!SOCKET_URL) return;
    const token = getToken();
    const socket = io(SOCKET_URL, {
      withCredentials: true,
      ...(token ? { auth: { token } } : {}),
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('association-chat:new-message', (incoming: ChatMessage) => {
      upsertMessage(incoming);
      scrollToBottom();
    });

    socket.on('connect_error', () => {
      // Fallback polling if socket auth/network is unavailable.
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!isApiConfigured()) return;
    const interval = window.setInterval(async () => {
      if (socketRef.current?.connected) return;
      try {
        const res = await associationChatApi.listMessages({ limit: 70 });
        setMessages(res.data.items || []);
        setHasMore(!!res.data.hasMore);
        setNextBeforeId(res.data.nextBeforeId || null);
      } catch {
        // silent fallback loop
      }
    }, 6000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="space-y-4">
      <PageHeader title={t('title')} description={t('subtitle')} />

      <div className="overflow-hidden rounded-3xl border border-violet-200/50 bg-gradient-to-b from-violet-50/70 via-background to-background shadow-[0_24px_60px_-30px_rgba(91,33,182,0.45)] dark:border-violet-900/50 dark:from-violet-950/25">
        <div className="flex items-center justify-between border-b border-violet-200/50 bg-card/90 px-4 py-3 backdrop-blur dark:border-violet-900/50">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-600/90 text-white shadow-md">
              <MessageCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{t('roomLabel')}</p>
              <p className="text-xs text-muted-foreground">online</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-violet-200/60 bg-background/80 text-muted-foreground transition hover:bg-violet-100/70 hover:text-foreground dark:border-violet-900/70 dark:hover:bg-violet-900/50"
            >
              <Search className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-violet-200/60 bg-background/80 text-muted-foreground transition hover:bg-violet-100/70 hover:text-foreground dark:border-violet-900/70 dark:hover:bg-violet-900/50"
            >
              <Phone className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between border-b border-violet-200/40 px-4 py-2 dark:border-violet-900/40">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('title')}</p>
          {hasMore ? (
            <Button size="sm" variant="secondary" onClick={loadOlder} disabled={loadingOlder}>
              {loadingOlder ? c('loading') : t('loadOlder')}
            </Button>
          ) : null}
        </div>

        <div ref={listRef} className="h-[58vh] space-y-2 overflow-y-auto bg-[radial-gradient(ellipse_at_top,_rgba(124,58,237,0.09),transparent_58%)] px-3 py-4">
          {loading ? <p className="text-sm text-muted-foreground">{c('loading')}</p> : null}
          {!loading && sortedMessages.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('empty')}</p>
          ) : null}

          {sortedMessages.map((message) => {
            const mine = selfId && message.sender.id === selfId;
            const senderFullName = `${message.sender.firstName || ''} ${message.sender.lastName || ''}`.trim();
            const senderName = senderFullName || message.sender.email;
            return (
              <div key={message.id} className={`flex items-end gap-2 ${mine ? 'justify-end' : 'justify-start'}`}>
                {!mine ? (
                  <div className="mb-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-600/90 text-[10px] font-semibold text-white shadow">
                    {senderInitials(message)}
                  </div>
                ) : null}
                <div
                  className={`max-w-[78%] rounded-2xl px-3 py-2 shadow-sm ${
                    mine
                      ? 'rounded-br-md bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white'
                      : 'rounded-bl-md border border-violet-200/60 bg-background/95 text-foreground dark:border-violet-900/50 dark:bg-card/80'
                  }`}
                >
                  <p className={`text-[11px] font-medium ${mine ? 'text-white/90' : 'text-muted-foreground'}`}>
                    {mine ? 'Tu' : senderName}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm">{message.text}</p>
                  <p className={`mt-1 text-right text-[10px] ${mine ? 'text-white/80' : 'text-muted-foreground'}`}>
                    {message.sender.role} · {timeLabel(message.createdAt)}
                  </p>
                </div>
                {mine ? (
                  <div className="mb-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-700 text-[10px] font-semibold text-white shadow">
                    {senderInitials(message)}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <form onSubmit={submit} className="border-t border-violet-200/60 bg-card/95 p-3 backdrop-blur dark:border-violet-900/50">
          <div className="flex items-end gap-2">
            <button
              type="button"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-violet-200/70 bg-background text-muted-foreground transition hover:bg-violet-100/70 hover:text-foreground dark:border-violet-900/70 dark:hover:bg-violet-900/40"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <textarea
              className="input min-h-[52px] flex-1 resize-none rounded-2xl border-violet-200/70 bg-background/95 focus:border-violet-400 dark:border-violet-900/70"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t('placeholder')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (!sending) {
                    void sendCurrentMessage();
                  }
                }
              }}
            />
            <button
              type="button"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-violet-200/70 bg-background text-muted-foreground transition hover:bg-violet-100/70 hover:text-foreground dark:border-violet-900/70 dark:hover:bg-violet-900/40"
            >
              <Smile className="h-4 w-4" />
            </button>
            <Button type="submit" disabled={sending || !draft.trim()}>
              {sending ? c('loading') : t('send')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
